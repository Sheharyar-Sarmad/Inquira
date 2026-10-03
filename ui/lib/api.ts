/**
 * Typed client for the Inquira research API (FastAPI router mounted at /api/v1/research).
 *
 *   POST {ORIGIN}/api/v1/research/async        { conversation_id, query } -> 202 JobCreated
 *   GET  {ORIGIN}/api/v1/research/jobs/{id}    -> JobStatus (404 = not found / expired)
 *   POST {ORIGIN}/api/v1/research              blocking variant (not used by the UI)
 *
 * ORIGIN comes from NEXT_PUBLIC_API_URL in .env (e.g. http://localhost:8000).
 * NEXT_PUBLIC_* values are inlined at build time: restart `pnpm dev` after changing it.
 */

const API_ORIGIN = process.env.NEXT_API_BASE_URL
const RESEARCH_BASE = `${API_ORIGIN}/api/v1/research`;

/* ------------------------------- Types ------------------------------------ */

export type ToolCall = { name: string; input: Record<string, unknown> };

export type JobCreated = {
  job_id: string;
  conversation_id: string;
  status: string; // "pending" on creation
};

export type JobStatus = {
  job_id: string;
  conversation_id: string;
  status: string;
  answer?: string | null;
  tools_used: ToolCall[];
  cached: boolean;
  error?: string | null;
};

export type ResearchResult = {
  conversation_id: string;
  answer: string;
  request_id: string;
  tools_used: ToolCall[];
  cached: boolean;
};

/* ------------------------------- Errors ----------------------------------- */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number, // 0 = network failure
    public retryAfter?: number, // seconds, from the Retry-After header on 429
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** FastAPI errors are { detail: string } or { detail: [{ msg }] } (422 validation). */
async function readDetail(res: Response): Promise<string> {
  try {
    const d = (await res.json())?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg).filter(Boolean).join(" ") || res.statusText;
  } catch {}
  return res.statusText || `Request failed (${res.status})`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${RESEARCH_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Can't reach the research service. Check your connection and try again.", 0);
  }
  if (!res.ok) {
    const ra = Number(res.headers.get("Retry-After"));
    throw new ApiError(await readDetail(res), res.status, Number.isFinite(ra) ? ra : undefined);
  }
  return res.json() as Promise<T>;
}

/* ------------------------------ Endpoints --------------------------------- */

export type StartResearchOptions = {
  requireApproval?: boolean;
};

export async function startResearchJob(
  conversationId: string,
  query: string,
  signal?: AbortSignal,
  options: StartResearchOptions = {},
): Promise<{ job_id: string; conversation_id: string; status: string }> {
  const res = await fetch(`${API_ORIGIN}/api/v1/research/async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_id: conversationId,
      query,
      ...(options.requireApproval ? { require_approval: true } : {}),
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
    throw new ApiError(
      text || `Failed to start research (${res.status})`,
      res.status,
      retryAfter,
    );
  }

  return res.json();
}

export function getResearchJob(jobId: string, signal?: AbortSignal) {
  return request<JobStatus>(`/jobs/${encodeURIComponent(jobId)}`, { signal });
}

export function runResearch(conversationId: string, query: string, signal?: AbortSignal) {
  return request<ResearchResult>("", {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId, query }),
    signal,
  });
}