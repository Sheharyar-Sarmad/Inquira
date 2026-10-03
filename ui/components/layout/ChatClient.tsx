"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Square,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { Sparkle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  ApiError,
  getResearchJob,
  startResearchJob,
  type JobStatus,
  type ToolCall,
} from "@/lib/api";
import { saveConversation } from "@/lib/conversations";

import MicButton from "@/components/helper/MicButton";
import DataChart from "@/components/helper/DataChart";
import type { ChartSpec } from "../helper/Chart";

/* -------------------------------------------------------------------------- */
/*  Backend contract                                                          */
/*    POST /async                  {conversation_id, query, require_approval?} */
/*    GET  /jobs/{id}              -> JobStatus                                */
/*    POST /jobs/{id}/approve      {tool_id, decision}                         */
/* -------------------------------------------------------------------------- */

const MAX_QUERY = 10_000;
const MAX_WAIT_MS = 10 * 60_000;

const DONE_RE = /^(complete[d]?|done|success(ful)?|finished)$/i;
const FAILED_RE = /^(fail(ed|ure)?|error(ed)?|cancel(l)?ed)$/i;
const AWAIT_RE =
  /^(awaiting_approval|needs_approval|paused|pending_approval)$/i;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => (
        clearTimeout(t),
        reject(new DOMException("Aborted", "AbortError"))
      ),
      { once: true },
    );
  });

type PendingTool = { id: string; name: string; input: Record<string, unknown> };
type JobWithApproval = JobStatus & {
  pending_tools?: PendingTool[];
  summary?: string;
  chart?: ChartSpec;
};

type ProgressEvent = { kind: "status"; status: string };

async function pollJob(
  jobId: string,
  signal: AbortSignal,
  onProgress: (e: ProgressEvent) => void,
): Promise<JobWithApproval> {
  const started = Date.now();
  let delay = 1200;
  let failures = 0;
  for (;;) {
    await sleep(delay, signal);
    let job: JobWithApproval;
    try {
      job = (await getResearchJob(jobId, signal)) as JobWithApproval;
      failures = 0;
    } catch (e) {
      const err = e as ApiError;
      if (err.name === "AbortError" || err.status === 404 || ++failures > 3)
        throw e;
      delay = Math.min(delay * 1.5, 5000);
      continue;
    }
    onProgress({ kind: "status", status: job.status });
    if (job.error || FAILED_RE.test(job.status))
      throw new Error(job.error || "The research job failed.");
    if (job.pending_tools?.length || AWAIT_RE.test(job.status)) return job;
    if (job.answer != null || DONE_RE.test(job.status)) return job;
    if (Date.now() - started > MAX_WAIT_MS)
      throw new Error(
        "This research is taking longer than expected. Please try again.",
      );
    delay = Math.min(delay * 1.2, 3500);
  }
}

function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429)
      return `You're sending requests too quickly. Please wait about ${e.retryAfter ?? 60} seconds and try again.`;
    if (e.status === 404)
      return "This research job expired before it finished. Please ask again.";
    return e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

/* -------------------------------------------------------------------------- */
/*  Text-to-speech hook                                                       */
/*                                                                            */
/*  Fixes common Web Speech API pitfalls:                                     */
/*    - Chrome loads voices asynchronously; we cache them in state.           */
/*    - cancel() immediately before speak() can silently no-op; we add a      */
/*      small delay so the cancel actually lands first.                       */
/* -------------------------------------------------------------------------- */

function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^[#>*_~+\-]+\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function useTextToSpeech() {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const timerRef = useRef<number | null>(null);

  /* Load voices (Chrome populates async via `voiceschanged`). */
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) setVoices(v);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, [supported]);

  /* Cancel any in-flight speech on unmount. */
  useEffect(() => {
    if (!supported) return;
    return () => {
      window.speechSynthesis.cancel();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [supported]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (!supported) return;
      const clean = stripForSpeech(text);
      if (!clean) return;

      /* Stop whatever is playing, then start fresh on the next tick. */
      window.speechSynthesis.cancel();
      if (timerRef.current) window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(() => {
        const u = new SpeechSynthesisUtterance(clean);
        u.rate = 1.02;
        u.pitch = 1;

        const preferred =
          voices.find((v) =>
            /Google (US|UK) English|Samantha|Daniel|Karen|Serena/i.test(v.name),
          ) ??
          voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ??
          voices[0];
        if (preferred) u.voice = preferred;

        u.onend = () => setSpeakingId((cur) => (cur === id ? null : cur));
        u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));

        setSpeakingId(id);
        window.speechSynthesis.speak(u);
      }, 50);
    },
    [supported, voices],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  return { supported, speakingId, speak, stop };
}

/* -------------------------------------------------------------------------- */
/*  Conversation                                                              */
/* -------------------------------------------------------------------------- */

type Message = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  toolsUsed?: ToolCall[];
  chart?: ChartSpec;
  summary?: string;
  cached?: boolean;
  query?: string;
};

type Pending = { jobId: string; tools: PendingTool[] };

const PENDING_PREFIX = "inquira:pending:";
const storeKey = (id: string) => `inquira:conv:${id}`;
const jobKey = (id: string) => `inquira:job:${id}`;
const hitlKey = "inquira:require-approval";
const uid = () =>
  `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function Conversation({ id }: { id: string }) {
  const reduce = useReducedMotion();
  const tts = useTextToSpeech();

  const [messages, setMessages] = useState<Message[]>([]);
  const [run, setRun] = useState<{ status: string; since: number } | null>(
    null,
  );
  const [pending, setPending] = useState<Pending | null>(null);
  const [ready, setReady] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setRequireApproval(localStorage.getItem(hitlKey) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(hitlKey, requireApproval ? "1" : "0");
    } catch {}
  }, [requireApproval]);

  const push = useCallback(
    (m: Message) =>
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, m],
      ),
    [],
  );

  const driveJob = useCallback(
    async (jobId: string, ac: AbortController) => {
      const result = await pollJob(jobId, ac.signal, (e) =>
        setRun((r) => (r ? { ...r, status: e.status } : r)),
      );

      if (result.pending_tools?.length) {
        setPending({ jobId, tools: result.pending_tools });
        setRun({ status: "awaiting_approval", since: Date.now() });
        return;
      }

      push({
        id: uid(),
        role: "assistant",
        content: result.answer ?? "",
        toolsUsed: result.tools_used,
        chart: result.chart,
        summary: result.summary,
        cached: result.cached,
      });
      sessionStorage.removeItem(jobKey(id));
      setPending(null);
    },
    [id, push],
  );

  const send = useCallback(
    async (
      query: string,
      opts: {
        userId?: string;
        resumeJobId?: string;
        pendingKey?: string;
        retryOf?: string;
      } = {},
    ) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      stoppedRef.current = false;

      if (opts.retryOf) {
        setMessages((p) => p.filter((m) => m.id !== opts.retryOf));
      } else if (!opts.resumeJobId) {
        push({ id: opts.userId ?? uid(), role: "user", content: query });
        /* Record this thread in the sidebar. First call creates the entry
         * with the query as title; later calls just bump `updatedAt`. */
        saveConversation(id, query);
      }

      setRun({ status: "pending", since: Date.now() });

      try {
        let jobId = opts.resumeJobId;
        if (!jobId) {
          const job = await startResearchJob(id, query, ac.signal, {
            requireApproval,
          });
          jobId = job.job_id;
          try {
            sessionStorage.setItem(
              jobKey(id),
              JSON.stringify({ jobId, query }),
            );
            if (opts.pendingKey) sessionStorage.removeItem(opts.pendingKey);
          } catch {}
        }
        await driveJob(jobId, ac);
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          if (stoppedRef.current) {
            push({
              id: uid(),
              role: "error",
              content:
                "Stopped waiting. The job may still finish on the server.",
              query,
            });
            sessionStorage.removeItem(jobKey(id));
          }
          return;
        }
        push({ id: uid(), role: "error", content: describeError(e), query });
        try {
          sessionStorage.removeItem(jobKey(id));
          if (opts.pendingKey) sessionStorage.removeItem(opts.pendingKey);
        } catch {}
      } finally {
        if (abortRef.current === ac) setRun(null);
      }
    },
    [id, push, driveJob, requireApproval],
  );

  useEffect(() => {
    let stored: Message[] = [];
    let pendingQuery: string | null = null;
    let job: { jobId: string; query: string } | null = null;
    try {
      stored = JSON.parse(sessionStorage.getItem(storeKey(id)) ?? "[]");
      pendingQuery = sessionStorage.getItem(PENDING_PREFIX + id);
      job = JSON.parse(sessionStorage.getItem(jobKey(id)) ?? "null");
    } catch {}
    setMessages((prev) => (prev.length ? prev : stored));
    setReady(true);

    if (pendingQuery)
      void send(pendingQuery, {
        userId: `pending-${id}`,
        pendingKey: PENDING_PREFIX + id,
      });
    else if (job?.jobId) void send(job.query, { resumeJobId: job.jobId });

    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(
        storeKey(id),
        JSON.stringify(messages.slice(-100)),
      );
    } catch {}
  }, [messages, ready, id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el)
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reduce ? "auto" : "smooth",
      });
  }, [messages, run, pending, reduce]);

  const stop = () => {
    stoppedRef.current = true;
    abortRef.current?.abort();
  };

  const decide = async (toolId: string, decision: "approve" | "reject") => {
    if (!pending) return;
    const { jobId } = pending;
    setPending((p) =>
      p ? { ...p, tools: p.tools.filter((t) => t.id !== toolId) } : p,
    );
    try {
      await approveResearchJob(
        jobId,
        toolId,
        decision,
        abortRef.current?.signal,
      );
    } catch (e) {
      push({ id: uid(), role: "error", content: describeError(e) });
      return;
    }
    setPending((p) => {
      const next = p
        ? { ...p, tools: p.tools.filter((t) => t.id !== toolId) }
        : null;
      if (next && next.tools.length === 0) {
        const ac = new AbortController();
        abortRef.current = ac;
        setRun({ status: "researching", since: Date.now() });
        void driveJob(jobId, ac).catch((e) => {
          push({ id: uid(), role: "error", content: describeError(e) });
          setRun(null);
        });
        return null;
      }
      return next;
    });
  };

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] min-w-0 flex-col xl:h-dvh">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        aria-live="polite"
        aria-busy={!!run}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
          {ready && messages.length === 0 && !run && !pending && (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Sparkle size={22} weight="fill" />
              </span>
              <h1 className="text-2xl font-semibold tracking-tight">
                What would you like to research?
              </h1>
              <p className="text-sm text-muted-foreground">
                Ask a question below — type it or tap the mic.
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                {m.role === "user" && <UserMessage text={m.content} />}
                {m.role === "assistant" && (
                  <AssistantMessage
                    m={m}
                    speaking={tts.speakingId === m.id}
                    onSpeak={() => {
                      if (tts.speakingId === m.id) {
                        tts.stop();
                        return;
                      }
                      /* Read summary first, then the full report. */
                      const spoken = m.summary
                        ? `Summary. ${m.summary}. ${m.content}`
                        : m.content;
                      tts.speak(m.id, spoken);
                    }}
                    ttsSupported={tts.supported}
                  />
                )}
                {m.role === "error" && (
                  <ErrorMessage
                    m={m}
                    onRetry={
                      m.query && !run
                        ? () => send(m.query!, { retryOf: m.id })
                        : undefined
                    }
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {pending && pending.tools.length > 0 && (
            <ApprovalPanel tools={pending.tools} onDecide={decide} />
          )}

          {run && !pending && (
            <RunningIndicator status={run.status} since={run.since} />
          )}
        </div>
      </div>

      <Composer
        busy={!!run}
        requireApproval={requireApproval}
        onToggleApproval={() => setRequireApproval((v) => !v)}
        onSend={(q) => send(q)}
        onStop={stop}
      />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Messages                                                                  */
/* -------------------------------------------------------------------------- */

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
        {text}
      </p>
    </div>
  );
}

const md: Components = {
  p: (p) => <p className="leading-7 [&:not(:first-child)]:mt-4" {...p} />,
  h1: (p) => (
    <h2
      className="mt-8 mb-3 text-xl font-semibold tracking-tight first:mt-0"
      {...p}
    />
  ),
  h2: (p) => (
    <h2
      className="mt-8 mb-3 text-lg font-semibold tracking-tight first:mt-0"
      {...p}
    />
  ),
  h3: (p) => (
    <h3 className="mt-6 mb-2 text-base font-semibold first:mt-0" {...p} />
  ),
  ul: (p) => (
    <ul
      className="mt-4 list-disc space-y-1.5 pl-6 marker:text-muted-foreground"
      {...p}
    />
  ),
  ol: (p) => (
    <ol
      className="mt-4 list-decimal space-y-1.5 pl-6 marker:text-muted-foreground"
      {...p}
    />
  ),
  a: ({ href, ...p }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
      {...p}
    />
  ),
  blockquote: (p) => (
    <blockquote
      className="mt-4 border-l-2 border-brand/40 pl-4 text-muted-foreground"
      {...p}
    />
  ),
  hr: () => <hr className="my-6 border-border" />,
  pre: (p) => (
    <pre
      className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-[13px] leading-6"
      {...p}
    />
  ),
  code: ({ className, ...p }) => (
    <code
      className={cn(
        "font-mono text-[0.9em]",
        !className && "rounded bg-muted px-1.5 py-0.5",
        className,
      )}
      {...p}
    />
  ),
  table: (p) => (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm" {...p} />
    </div>
  ),
  th: (p) => (
    <th
      className="border-b border-border bg-muted/60 px-3 py-2 text-left font-medium"
      {...p}
    />
  ),
  td: (p) => (
    <td className="border-b border-border px-3 py-2 last:border-b-0" {...p} />
  ),
};

const AssistantMessage = memo(function AssistantMessage({
  m,
  speaking,
  onSpeak,
  ttsSupported,
}: {
  m: Message;
  speaking: boolean;
  onSpeak: () => void;
  ttsSupported: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const tools = m.toolsUsed ?? [];

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Sparkle size={15} weight="fill" />
      </span>
      <div className="min-w-0 flex-1">
        {m.summary && (
          <div className="mb-5 rounded-xl border border-brand/25 bg-brand-soft p-4 text-[15px] text-foreground shadow-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
              Summary
            </p>
            <p className="leading-7">{m.summary}</p>
          </div>
        )}

        <div className="text-[15px] break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
            {m.content}
          </ReactMarkdown>
        </div>

        {m.chart && <DataChart spec={m.chart} />}

        {tools.length > 0 && (
          <details className="mt-5 rounded-lg border border-border bg-muted/40 text-sm">
            <summary className="cursor-pointer select-none px-3 py-2 text-muted-foreground hover:text-foreground">
              {tools.length} tool call{tools.length > 1 && "s"} used
            </summary>
            <ul className="divide-y divide-border border-t border-border">
              {tools.map((t, i) => (
                <li key={i} className="px-4 py-3">
                  <code className="font-mono text-xs text-brand">{t.name}</code>
                  {Object.keys(t.input).length > 0 && (
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-background/60 p-3 font-mono text-xs leading-5 text-muted-foreground">
                      {JSON.stringify(t.input, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(m.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>

          {ttsSupported && (
            <button
              type="button"
              onClick={onSpeak}
              aria-pressed={speaking}
              aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none",
                speaking && "text-brand",
              )}
            >
              {speaking ? (
                <VolumeX className="size-3.5" />
              ) : (
                <Volume2 className="size-3.5" />
              )}
              {speaking ? "Stop" : "Listen"}
            </button>
          )}

          {m.cached && (
            <span className="rounded-full border border-border px-2 py-0.5">
              Cached result
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

function ErrorMessage({ m, onRetry }: { m: Message; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="flex-1 leading-relaxed">{m.content}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
        >
          <RotateCcw className="size-3" /> Retry
        </button>
      )}
    </div>
  );
}

function RunningIndicator({
  status,
  since,
}: {
  status: string;
  since: number;
}) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setSecs(Math.floor((Date.now() - since) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [since]);
  const label = /^pending$/i.test(status)
    ? "Queued"
    : AWAIT_RE.test(status)
      ? "Waiting for your approval"
      : "Researching";
  return (
    <div
      className="flex items-center gap-3 text-sm text-muted-foreground"
      role="status"
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Sparkle
          size={15}
          weight="fill"
          className="motion-safe:animate-pulse"
        />
      </span>
      <span>
        {label}… <span className="tabular-nums">{secs}s</span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Approval panel                                                            */
/* -------------------------------------------------------------------------- */

function ApprovalPanel({
  tools,
  onDecide,
}: {
  tools: PendingTool[];
  onDecide: (toolId: string, decision: "approve" | "reject") => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const decide = (id: string, d: "approve" | "reject") => {
    setBusyId(id);
    onDecide(id, d);
  };
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
      aria-label="Tool approval required"
    >
      <div className="mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <ShieldCheck className="size-4" />
        <p className="font-medium">
          {tools.length} tool call{tools.length > 1 && "s"} need your approval
        </p>
      </div>
      <ul className="space-y-3">
        {tools.map((t) => (
          <li
            key={t.id}
            className="rounded-lg border border-border bg-background p-3"
          >
            <code className="font-mono text-xs text-brand">{t.name}</code>
            {Object.keys(t.input).length > 0 && (
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 font-mono text-xs leading-5 text-muted-foreground">
                {JSON.stringify(t.input, null, 2)}
              </pre>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={busyId === t.id}
                onClick={() => decide(t.id, "approve")}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none disabled:opacity-50"
              >
                {busyId === t.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                Approve
              </button>
              <button
                type="button"
                disabled={busyId === t.id}
                onClick={() => decide(t.id, "reject")}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none disabled:opacity-50"
              >
                <XCircle className="size-3.5" /> Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Composer                                                                  */
/* -------------------------------------------------------------------------- */

function Composer({
  busy,
  requireApproval,
  onToggleApproval,
  onSend,
  onStop,
}: {
  busy: boolean;
  requireApproval: boolean;
  onToggleApproval: () => void;
  onSend: (q: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const submit = () => {
    const q = value.trim();
    if (!q || busy) return;
    onSend(q);
    setValue("");
  };

  return (
    <div className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <form
        onSubmit={(e) => (e.preventDefault(), submit())}
        className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10"
      >
        <label htmlFor="chat-query" className="sr-only">
          Ask a research question
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-query"
            ref={taRef}
            value={value}
            rows={1}
            maxLength={MAX_QUERY}
            placeholder={
              busy ? "Researching…" : "Ask a follow-up or a new question"
            }
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-42 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-muted-foreground/70"
          />

          <MicButton value={value} onText={setValue} disabled={busy} />

          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop waiting for the answer"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!value.trim()}
              aria-label="Send"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground transition-all hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowUp className="size-[18px]" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Entry                                                                     */
/* -------------------------------------------------------------------------- */

export default function ChatClient() {
  const router = useRouter();
  const c = useSearchParams().get("c");

  useEffect(() => {
    if (!c) {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `c-${Date.now().toString(36)}-${Math.random()
              .toString(36)
              .slice(2, 10)}`;
      router.replace(`/research?c=${encodeURIComponent(id)}`);
    }
  }, [c, router]);

  if (!c) return <main className="flex-1" />;
  return <Conversation key={c} id={c.slice(0, 100)} />;
}

/* -------------------------------------------------------------------------- */
/*  HITL shim (kept local until lib/api.ts grows an approveResearchJob)       */
/* -------------------------------------------------------------------------- */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function approveResearchJob(
  jobId: string,
  toolId: string,
  decision: "approve" | "reject",
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/v1/research/jobs/${encodeURIComponent(jobId)}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_id: toolId, decision }),
      signal,
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      text || `Approval failed (${res.status})`, // ← message (string)
      res.status, // ← status (number)
    );
  }
}
