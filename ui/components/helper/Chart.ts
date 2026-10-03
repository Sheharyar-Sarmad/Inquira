/**
 * Turns the markdown the agent already returns into chartable data.
 * Nothing is invented: only numeric columns of real tables (or an explicit ```chart block) are plotted.
 */

export type ChartMetric = { key: string; label: string; unit: string };
export type ChartRow = { label: string } & Record<string, string | number | null>;
export type ChartSpec = { title?: string; metrics: ChartMetric[]; rows: ChartRow[] };

export type Segment = { type: "md" | "table"; text: string };

const SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Splits markdown into prose chunks and GFM table blocks (ignoring fenced code). */
export function splitMarkdown(md: string): Segment[] {
  const lines = md.split("\n");
  const out: Segment[] = [];
  let buf: string[] = [];
  let fenced = false;
  const flush = () => {
    if (buf.length) out.push({ type: "md", text: buf.join("\n") });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && line.includes("|") && i + 1 < lines.length && SEP.test(lines[i + 1])) {
      let j = i + 2;
      while (j < lines.length && lines[j].includes("|") && lines[j].trim() !== "") j++;
      flush();
      out.push({ type: "table", text: lines.slice(i, j).join("\n") });
      i = j - 1;
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
}

const NUM = /^[~≈<>≤≥+$€£]?\s*(-?\d[\d,]*(?:\.\d+)?)\s*(%|ms|µs|us|s|k|m|b|x|kb|mb|gb|tb|qps|rps)?(?:\/\w+)?$/i;
const MULT: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

function toNum(cell: string): { n: number; unit: string } | null {
  const m = cell.match(NUM);
  if (!m) return null;
  const suffix = (m[2] ?? "").toLowerCase();
  const n = parseFloat(m[1].replace(/,/g, "")) * (MULT[suffix] ?? 1);
  return Number.isFinite(n) ? { n, unit: MULT[suffix] ? "" : suffix } : null;
}

const cells = (l: string) =>
  l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim().replace(/\*\*|__|`/g, ""));

export function parseTable(text: string): ChartSpec | null {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 4) return null;
  const header = cells(lines[0]);
  const rows = lines.slice(2).map(cells).filter((r) => r.length >= 2);
  if (rows.length < 2 || rows.length > 16) return null;

  const metrics: ChartMetric[] = [];
  const cols: { key: string; vals: ({ n: number } | null)[] }[] = [];
  for (let c = 1; c < header.length && metrics.length < 6; c++) {
    const vals = rows.map((r) => toNum(r[c] ?? ""));
    const filled = rows.filter((r) => (r[c] ?? "") !== "").length;
    const nums = vals.filter(Boolean).length;
    if (nums >= 2 && nums / Math.max(filled, 1) >= 0.8) {
      const key = `m${c}`;
      const unit = vals.find(Boolean) ? toNum(rows[vals.findIndex(Boolean)][c])!.unit : "";
      metrics.push({ key, label: header[c] || `Column ${c}`, unit });
      cols.push({ key, vals });
    }
  }
  if (!metrics.length) return null;

  return {
    metrics,
    rows: rows.map((r, i) => {
      const row: ChartRow = { label: r[0] || `Row ${i + 1}` };
      for (const col of cols) row[col.key] = col.vals[i]?.n ?? null;
      return row;
    }),
  };
}

/** Optional explicit block the agent can emit: ```chart {"title":"…","unit":"ms","data":[{"label":"A","value":1}]} */
export function parseChartBlock(raw: string): ChartSpec | null {
  try {
    const j = JSON.parse(raw);
    if (!Array.isArray(j?.data) || j.data.length < 2 || j.data.length > 24) return null;
    const rows: ChartRow[] = [];
    for (const d of j.data) {
      if (typeof d?.label !== "string" || typeof d?.value !== "number" || !Number.isFinite(d.value)) return null;
      rows.push({ label: d.label, m0: d.value });
    }
    return {
      title: typeof j.title === "string" ? j.title : undefined,
      metrics: [{ key: "m0", label: typeof j.metric === "string" ? j.metric : "Value", unit: typeof j.unit === "string" ? j.unit : "" }],
      rows,
    };
  } catch {
    return null;
  }
}

export function formatValue(v: number, unit = ""): string {
  const abs = Math.abs(v);
  const s =
    abs >= 10_000
      ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(v)
      : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(v);
  return unit === "%" ? `${s}%` : unit ? `${s} ${unit}` : s;
}