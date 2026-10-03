"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import {
  ChatCircleDots,
  MagnifyingGlass,
  Globe,
  Brain,
  Lightbulb,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

const MAX_QUERY = 10_000; // backend: ResearchRequest.query max_length
const PENDING_PREFIX = "inquira:pending:"; // read (once) by ChatClient

const STEPS = [
  { label: "Ask", icon: ChatCircleDots },
  { label: "Research", icon: MagnifyingGlass },
  { label: "Discover", icon: Globe },
  { label: "Analyze", icon: Brain },
  { label: "Understand", icon: Lightbulb },
] as const;

const SUGGESTIONS = [
  "How do multi-agent systems coordinate on complex tasks?",
  "What are the current approaches to evaluating RAG pipelines?",
  "Compare vector databases for production semantic search",
  "How does attention cost scale with context length?",
];

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function HomeHero() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // autosize the composer
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const canSubmit = value.trim().length > 0 && !busy;

  const submit = useCallback(() => {
    const query = value.trim();
    if (!query || busy) return;
    setBusy(true);
    const id = newId();
    try {
      sessionStorage.setItem(PENDING_PREFIX + id, query);
    } catch {}
    router.push(`/research?c=${encodeURIComponent(id)}`);
  }, [value, busy, router]);

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative flex min-h-[calc(100dvh-3.5rem)] flex-1 items-center justify-center overflow-hidden px-4 py-16 xl:min-h-dvh">
        <motion.div
          variants={list}
          initial="hidden"
          animate="show"
          className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center"
        >
          {/* Updated Logo Section */}
          <motion.span
            variants={item}
            className="mb-8 flex h-10 items-center gap-2 rounded-xl dark:bg-white dark:px-4"
          >
            <Image
              src="/logo.png"
              alt="Inquira Logo"
              width={0}
              height={0}
              sizes="200px"
              // priority
              className="h-8 w-auto max-w-none"
            />
            <span className="text-xl font-bold tracking-tight text-foreground dark:text-black">
              Inquira
            </span>
          </motion.span>

          <motion.h1
            variants={item}
            className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl"
          >
            Research{" "}
            <span className="bg-gradient-to-r from-brand to-signal bg-clip-text text-transparent">
              anything.
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-5 text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Explore the web. Analyze knowledge.
            <br className="hidden sm:block" /> Discover evidence.
          </motion.p>

          {/* Composer */}
          <motion.form
            variants={item}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="mt-10 w-full rounded-2xl border border-border bg-card/80 p-2 text-left shadow-sm backdrop-blur-md transition-colors focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10"
          >
            <label htmlFor="hero-query" className="sr-only">
              What do you want to research?
            </label>
            <textarea
              id="hero-query"
              ref={taRef}
              value={value}
              rows={1}
              maxLength={MAX_QUERY}
              autoFocus
              placeholder="What do you want to research?"
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
              className="max-h-42 w-full resize-none bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground/70"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="hidden text-xs text-muted-foreground sm:block">
                <kbd className="font-mono">Enter</kbd> to research ·{" "}
                <kbd className="font-mono">Shift + Enter</kbd> for a new line
              </span>
              <button
                type="submit"
                disabled={!canSubmit}
                aria-label="Start research"
                className={cn(
                  "ml-auto flex size-9 items-center justify-center rounded-lg bg-brand text-brand-foreground transition-all",
                  "hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none",
                  "disabled:cursor-not-allowed disabled:opacity-35",
                )}
              >
                <ArrowUp className="size-[18px]" />
              </button>
            </div>
          </motion.form>

          {/* Starter prompts */}
          <motion.div
            variants={item}
            className="mt-5 flex flex-wrap justify-center gap-2"
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setValue(s);
                  taRef.current?.focus();
                }}
                className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
              >
                {s}
              </button>
            ))}
          </motion.div>

          {/* Ask → Research → Discover → Analyze → Understand */}
          <motion.ol
            variants={item}
            aria-label="How Inquira works"
            className="mt-12 flex items-center gap-1.5 text-xs text-muted-foreground sm:gap-3"
          >
            {STEPS.map(({ label, icon: Icon }, i) => (
              <li key={label} className="flex items-center gap-1.5 sm:gap-3">
                <motion.span
                  animate={
                    reduce ? undefined : { opacity: [0.45, 1, 0.45, 0.45] }
                  }
                  transition={{
                    duration: 6,
                    times: [0, 0.08, 0.2, 1],
                    repeat: Infinity,
                    delay: i * 1,
                  }}
                  className="flex items-center gap-1.5"
                >
                  <Icon size={15} className="text-brand" />
                  <span className="hidden sm:inline">{label}</span>
                </motion.span>
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="h-px w-3 bg-border sm:w-6" />
                )}
              </li>
            ))}
          </motion.ol>
        </motion.div>
      </main>
    </MotionConfig>
  );
}