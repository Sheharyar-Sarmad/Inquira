"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Brain,
  Database,
  GitBranch,
  GitMerge,
  Layers,
  Lightbulb,
  Mail,
  Mic,
  Network,
  ShieldCheck,
  Sparkles,
  Volume2,
  Zap,
  Boxes,
} from "lucide-react";
import {
  GithubLogo,
  LinkedinLogo,
  Sparkle,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

import Mermaid from "@/components/helper/Mermaid";

/* -------------------------------------------------------------------------- */
/*  Motion                                                                    */
/* -------------------------------------------------------------------------- */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/* -------------------------------------------------------------------------- */
/*  Diagram wrapper                                                           */
/*  - `!w-full`: SVG fills the card width                                     */
/*  - `!h-auto`: height scales from the viewBox aspect ratio                  */
/*  - `max-h-[70vh]`: hard cap so tall diagrams never overflow the viewport   */
/*  - `overflow-hidden`: clips leaked Mermaid artifacts (belt & braces)       */
/*  - SVG's own preserveAspectRatio letterboxes the content inside that box.  */
/* -------------------------------------------------------------------------- */

const DIAGRAM_WRAP = [
  "relative mt-10 w-full overflow-hidden rounded-2xl border border-border bg-card",
  "p-6 sm:p-10",
  "[&_svg]:mx-auto [&_svg]:block",
  "[&_svg]:!w-full [&_svg]:!h-auto",
  "[&_svg]:!max-w-none",           // kills Mermaid's inline max-width
  "[&_svg]:!min-h-[420px]",         // makes short diagrams breathe
  "[&_svg]:!max-h-[80vh]",          // a bit more headroom than 70vh
].join(" ");

/* -------------------------------------------------------------------------- */
/*  Mermaid style blocks                                                      */
/* -------------------------------------------------------------------------- */

const CLASS_DEFS = `
    classDef agent    fill:#1E1B4B,stroke:#A78BFA,stroke-width:2px,color:#F8FAFC
    classDef agentAlt fill:#312E81,stroke:#8B5CF6,stroke-width:2px,color:#F8FAFC
    classDef critic   fill:#78350F,stroke:#F59E0B,stroke-width:2.5px,color:#FEF3C7
    classDef tool     fill:#083344,stroke:#06B6D4,stroke-width:1.5px,color:#E0F7FA
    classDef external fill:#0F172A,stroke:#3B82F6,stroke-width:1.5px,color:#DBEAFE
    classDef store    fill:#064E3B,stroke:#10B981,stroke-width:1.5px,color:#D1FAE5
    classDef terminal fill:#334155,stroke:#94A3B8,stroke-width:1.5px,color:#F1F5F9
    classDef retry    fill:#4C0519,stroke:#F43F5E,stroke-width:1.5px,color:#FFE4E6
    classDef browser  fill:#1E1B4B,stroke:#A78BFA,stroke-width:2px,color:#F8FAFC
    classDef api      fill:#083344,stroke:#06B6D4,stroke-width:2px,color:#E0F7FA
`;

/* -------------------------------------------------------------------------- */
/*  01 — Six-agent topology                                                   */
/* -------------------------------------------------------------------------- */

const SIX_AGENT_TOPOLOGY = `
flowchart TB
    Q([User Query]):::terminal
    Q --> WF[Workflow<br/>Orchestrator]:::agentAlt
    WF --> RA[Research Agent<br/>planner · all tools]:::agent
    RA --> SPLIT{Fan-out?}:::critic
    SPLIT -->|web| WRA[Web Research<br/>Agent]:::agent
    SPLIT -->|academic| AA[ArXiv<br/>Agent]:::agent
    SPLIT -->|background| WA[Wikipedia<br/>Agent]:::agent
    WRA --> POOL[(Evidence Pool)]:::store
    AA --> POOL
    WA --> POOL
    POOL --> CA[Critic Agent<br/>verify + decide]:::critic
    CA -->|needs more| RA
    CA -->|sufficient| WR[Writer Agent<br/>synthesise]:::agent
    WR --> R([Structured Report]):::terminal
${CLASS_DEFS}
`;

/* -------------------------------------------------------------------------- */
/*  02 — Specialist ↔ tool routing                                            */
/* -------------------------------------------------------------------------- */

const TOOL_ROUTING = `
flowchart LR
    subgraph Agents["Six Agents"]
        direction TB
        RA[Research Agent]:::agent
        WRA[Web Research Agent]:::agent
        AA[ArXiv Agent]:::agent
        WA[Wikipedia Agent]:::agent
        CA[Critic Agent]:::critic
        WR[Writer Agent]:::agent
    end
    subgraph Tools["Four Tools"]
        direction TB
        TW[search_web<br/>Tavily]:::tool
        TWI[search_wikipedia]:::tool
        TA[search_arxiv]:::tool
        TF[get_firecrawl_tool]:::tool
    end
    subgraph Ext["External APIs"]
        direction TB
        ET[Tavily API]:::external
        EWI[Wikipedia API]:::external
        EA[arXiv API]:::external
        EF[Firecrawl API]:::external
    end
    RA --> TW
    RA --> TWI
    RA --> TA
    RA --> TF
    WRA --> TW
    WRA --> TF
    AA --> TA
    WA --> TWI
    TW --> ET
    TWI --> EWI
    TA --> EA
    TF --> EF
${CLASS_DEFS}
`;

/* -------------------------------------------------------------------------- */
/*  03 — Full system architecture (LR to fit 70vh)                            */
/* -------------------------------------------------------------------------- */

const FULL_SYSTEM = `
flowchart LR
    subgraph Browser["Browser — Next.js 15"]
        direction TB
        UI[ChatClient]:::browser
        Charts[DataChart]:::browser
        Voice[Voice I/O]:::browser
        SS[(sessionStorage<br/>job id)]:::store
    end

    subgraph API["FastAPI Backend"]
        direction TB
        Async[POST /research/async]:::api
        Jobs[GET /research/jobs/id]:::api
        Redis[(Redis<br/>jobs + cache)]:::store
    end

    subgraph Graph["Agent Graph"]
        direction TB
        WF[Workflow]:::agentAlt
        Agents[Six Specialist Agents]:::agent
        Tools[Four Tool Bindings]:::tool
    end

    subgraph Inference["LLM Inference"]
        direction TB
        Groq[Groq LPU<br/>OpenAI GPT-OSS 120B]:::external
    end

    subgraph External["External Knowledge"]
        direction TB
        T[Tavily]:::external
        W[Wikipedia]:::external
        A[arXiv]:::external
        F[Firecrawl]:::external
    end

    UI -->|POST| Async
    UI -->|poll| Jobs
    UI -.persist.-> SS

    Async --> Redis
    Jobs -.read.-> Redis
    Redis --> WF

    WF --> Agents
    Agents --> Tools
    Agents --> Groq
    Tools --> T
    Tools --> W
    Tools --> A
    Tools --> F

${CLASS_DEFS}
`;

/* -------------------------------------------------------------------------- */
/*  04 — Critic loop                                                          */
/* -------------------------------------------------------------------------- */

const CRITIC_LOOP = `
flowchart TD
    START([Round N begins]):::terminal
    START --> R[Research Agent<br/>plan + call tools]:::agent
    R --> P[(Collect Evidence)]:::store
    P --> C[Critic Agent<br/>reviews evidence]:::critic
    C --> Q{Enough to<br/>answer?}:::critic
    Q -->|gap found| TARGET[Target the gap<br/>pick specialist]:::agentAlt
    TARGET --> START
    Q -->|sufficient| W[Writer Agent]:::agent
    W --> END([Final Report]):::terminal
    Q -->|max rounds hit| W
${CLASS_DEFS}
`;

/* -------------------------------------------------------------------------- */
/*  05 — Resilience                                                           */
/* -------------------------------------------------------------------------- */

const RESILIENCE = `
flowchart TD
    L[LLM response]:::agent --> C{Has tool_calls?}:::critic
    C -->|yes| S[Sanitize names]:::agentAlt
    S --> V{Valid in<br/>TOOLS_BY_NAME?}:::critic
    V -->|yes| E[Execute tool]:::tool
    V -->|no| K[Strip control tokens<br/>and retry]:::retry
    K --> V
    C -->|no| RT[Return assistant content]:::agentAlt
    E --> N[Append ToolMessage]:::tool
    N --> L
    L -.400 tool_use_failed.-> R[invoke_model<br/>retry ×3 backoff]:::retry
    R --> L
    TL[Tool throws]:::retry --> SW[Swallow + continue<br/>with other tools]:::agentAlt
${CLASS_DEFS}
`;

/* -------------------------------------------------------------------------- */
/*  Content                                                                   */
/* -------------------------------------------------------------------------- */

const STACK = [
  { name: "Next.js 15", role: "App Router, RSC, edge-ready routing" },
  { name: "React 19", role: "Server + client components, Suspense" },
  { name: "Tailwind CSS", role: "Design tokens, dark mode, container queries" },
  { name: "Framer Motion", role: "Scroll-triggered, reduced-motion-aware transitions" },
  { name: "Mermaid", role: "Live architecture diagrams" },
  { name: "Recharts", role: "Bar / line / donut visualisations" },
  { name: "react-markdown + GFM", role: "Rich report rendering" },
  { name: "Web Speech API", role: "Dictation + text-to-speech" },
  { name: "FastAPI", role: "Async job API, OpenAPI docs" },
  { name: "LangChain create_agent", role: "Six-agent orchestration" },
  { name: "Groq LPU · GPT-OSS 120B", role: "High-throughput reasoning" },
  { name: "Redis", role: "Rate limiter + research cache" },
];

const NUMBERS = [
  { value: "6", label: "Specialist agents" },
  { value: "4", label: "Research tools" },
  { value: "≤3", label: "Critic rounds" },
  { value: "202", label: "Async accepted" },
];

const LINKS: {
  label: string;
  href: string;
  icon: PhosphorIcon;
  primary?: boolean;
}[] = [
  {
    label: "Inquira repository",
    href: "https://github.com/Sheharyar-Sarmad/Inquira",
    icon: GithubLogo,
    primary: true,
  },
  {
    label: "GitHub profile",
    href: "https://github.com/Sheharyar-Sarmad",
    icon: GithubLogo,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/sheharyar-sarmad-9b7736289/",
    icon: LinkedinLogo,
  },
  {
    label: "developersheharyar2010@gmail.com",
    href: "mailto:developersheharyar2010@gmail.com",
    icon: Mail,
  },
];

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function AboutClient() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-24">
      {/* ───────────────────── Hero ───────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-start gap-8"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full rounded-full bg-brand motion-safe:animate-ping" />
            <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
          </span>
          Inside Inquira
        </span>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Research that shows its work.
        </h1>

        <p className="max-w-3xl text-[15px] leading-8 text-muted-foreground">
          Inquira is a six-agent research platform. A research planner fans out
          to specialist agents, a critic verifies the evidence, and a writer
          produces a structured report — with charts, tool logs, and voice
          output. This page walks through the whole system, top to bottom.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/research"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
          >
            <Sparkle size={15} weight="fill" />
            Start a research thread
          </Link>
          <a
            href="https://github.com/Sheharyar-Sarmad/Inquira"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
          >
            View source
            <ArrowUpRight className="size-3.5" />
          </a>
        </div>

        <dl className="mt-4 grid w-full grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {NUMBERS.map((n) => (
            <div key={n.label} className="bg-card px-4 py-5">
              <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {n.label}
              </dt>
              <dd className="mt-1 text-3xl font-semibold tabular-nums">
                {n.value}
              </dd>
            </div>
          ))}
        </dl>
      </motion.section>

      {/* ─────────── 01 — Six-agent topology ─────────── */}
      <Section
        index="01"
        title="Six agents, one graph"
        kicker="The agentic core"
        icon={Brain}
        intro={
          <>
            Every query runs through a <strong>supervisor topology</strong>. A{" "}
            <strong>Research Agent</strong> plans the research and fans out to
            specialist agents — each focused on one kind of source. A{" "}
            <strong>Critic Agent</strong> then reviews the collected evidence and
            decides whether to loop back or hand the work to the{" "}
            <strong>Writer Agent</strong>.
            <br />
            <br />
            The critic is the piece that makes this reliable. A single agent
            deciding &ldquo;I&apos;m done&rdquo; is unpredictable — it either
            stops too early or loops forever. A dedicated verifier with no tools
            and a different objective is honest about gaps.
          </>
        }
      >
        <Mermaid
          chart={SIX_AGENT_TOPOLOGY}
          ariaLabel="Six-agent supervisor topology"
          className={DIAGRAM_WRAP}
        />
      </Section>

      {/* ─────────── 02 — Tool routing ─────────── */}
      <Section
        index="02"
        title="Specialists and their toolbelts"
        kicker="Which agent calls what"
        icon={Boxes}
        intro={
          <>
            Each agent owns a focused set of tools. The generalist{" "}
            <strong>Research Agent</strong> can call everything — but the
            specialists exist so the model can reason about one source type at a
            time. The <strong>ArXiv Agent</strong> doesn&apos;t have to think
            about Tavily&apos;s query syntax; the{" "}
            <strong>Wikipedia Agent</strong> doesn&apos;t have to worry about
            Firecrawl&apos;s rate limits.
            <br />
            <br />
            The <strong>Critic</strong> and <strong>Writer</strong> have no tools
            at all — they are pure reasoning nodes. That&apos;s deliberate: they
            can&apos;t accidentally trigger another tool call.
          </>
        }
      >
        <Mermaid
          chart={TOOL_ROUTING}
          ariaLabel="Tool routing between agents"
          className={DIAGRAM_WRAP}
        />
      </Section>

      {/* ─────────── 03 — Full system ─────────── */}
      <Section
        index="03"
        title="The full system"
        kicker="Browser → API → agents → tools"
        icon={Network}
        intro={
          <>
            The frontend is a Next.js App Router app. It never holds a research
            request open — every query becomes a job the server can outlive. The
            backend is a single FastAPI service with a Redis-backed job store and
            cache. External APIs sit behind the tool layer and are never called
            directly by the browser.
            <br />
            <br />
            Redis plays two roles: <strong>rate limiting</strong> (so four
            parallel tool calls don&apos;t trip Tavily&apos;s quota) and{" "}
            <strong>result caching</strong> (so the same query is not re-run).
          </>
        }
      >
        <Mermaid
          chart={FULL_SYSTEM}
          ariaLabel="Full system architecture"
          className={DIAGRAM_WRAP}
        />
      </Section>

      {/* ─────────── 04 — Critic loop ─────────── */}
      <Section
        index="04"
        title="The critic loop"
        kicker="Verify, then decide"
        icon={GitMerge}
        intro={
          <>
            The Critic Agent is the loop controller. It looks at the aggregated
            evidence and asks three questions:{" "}
            <em>is this factually supported?</em>{" "}
            <em>does it answer the original query?</em>{" "}
            <em>what&apos;s missing?</em> If it finds a gap, it names the specific
            specialist to re-invoke — not just &ldquo;go around again&rdquo;. If
            everything checks out, it hands off to the Writer.
            <br />
            <br />
            A hard round cap prevents runaway loops. If the critic can&apos;t be
            satisfied in three rounds, the writer runs anyway and the report notes
            the remaining uncertainty.
          </>
        }
      >
        <Mermaid
          chart={CRITIC_LOOP}
          ariaLabel="Critic loop mechanics"
          className={DIAGRAM_WRAP}
        />
      </Section>

      {/* ─────────── 05 — Resilience ─────────── */}
      <Section
        index="05"
        title="Resilience layer"
        kicker="Sanitize, validate, retry"
        icon={ShieldCheck}
        intro={
          <>
            Groq&apos;s hosting of{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
              openai/gpt-oss-120b
            </code>{" "}
            occasionally leaks control tokens into tool names — you might see{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
              search_arxiv&lt;|channel|&gt;commentary
            </code>{" "}
            instead of{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
              search_arxiv
            </code>
            . Groq then rejects its own output with a 400. The workflow catches
            this on three levels: sanitize before replay, retry transient errors
            with backoff, and fall back to a forced summary instead of failing
            the job.
          </>
        }
      >
        <Mermaid
          chart={RESILIENCE}
          ariaLabel="Resilience and sanitization flow"
          className={DIAGRAM_WRAP}
        />
        <SubGrid>
          <Feature
            title="Sanitize before replay"
            body="The corrupted name is stripped from the AIMessage before it's re-sent. Without this, the next round would 400 on the same history."
          />
          <Feature
            title="Retry with backoff"
            body="A transient tool_use_failed gets up to three attempts with increasing delay. Non-transient errors raise immediately."
          />
          <Feature
            title="Per-tool isolation"
            body="If one tool throws, the loop swallows it and continues with the others. A failed arXiv lookup doesn't kill a Wikipedia-only query."
          />
          <Feature
            title="Writer fallback"
            body="If the Writer Agent call fails, the raw research is returned rather than an error. The user still gets an answer."
          />
        </SubGrid>
      </Section>

      {/* ─────────── 06 — Design decisions ─────────── */}
      <Section
        index="06"
        title="Design decisions"
        kicker="What I built, and what I deliberately didn't"
        icon={Lightbulb}
        intro={
          <>
            Every architecture has trade-offs. The most interesting decisions
            here are the things I chose <em>not</em> to build — and why.
          </>
        }
      >
        <SubGrid>
          <Feature
            title="No human-in-the-loop gate"
            body="Web search, Wikipedia lookups, arXiv queries, and page scraping are all read-only, non-destructive operations. There is nothing to approve — no writes, no side effects, no irreversible actions. Adding a confirmation step for every tool call would slow down the pipeline for zero safety gain."
          />
          <Feature
            title="Cost is bounded elsewhere"
            body="The risk with autonomous agents isn't destructive actions — it's runaway cost. That's solved here with a Redis-backed rate limiter per tool, a hard cap on tool rounds (≤3), and duplicate-call suppression. The system can't spiral."
          />
          <Feature
            title="But it's trivially addable"
            body="The pattern is already in place for other features: a client-side flag persisted to localStorage, sent with each request. A HITL gate would be the same shape — flip requireApproval, backend parks the job in awaiting_approval, frontend renders an approval panel, decisions resume the run."
          />
          <Feature
            title="When it would matter"
            body="The moment Inquira grows a tool that writes — sending an email, posting to a service, charging a card, or modifying an external system — the HITL gate becomes non-negotiable. The architecture is ready for it; the current toolbelt just doesn't need it yet."
          />
        </SubGrid>
      </Section>

      {/* ─────────── 07 — Voice + charts ─────────── */}
      <Section
        index="07"
        title="Voice in, voice out"
        kicker="Dictate a question, listen to an answer"
        icon={Mic}
        intro={
          <>
            The composer exposes a microphone powered by the Web Speech API.
            Transcripts append into the same textarea you type into, so voice and
            keyboard mix freely. Every assistant message also gets a{" "}
            <em>Listen</em> button that reads the report aloud — with markdown,
            code fences, and tables stripped first so the read-aloud sounds like
            natural speech. When a report contains numeric data, the frontend
            renders a chart with animation, tooltips, and a screen-reader data
            table behind it.
          </>
        }
      >
        <SubGrid>
          <Feature
            icon={Mic}
            title="Dictation"
            body="Live transcript appends to the existing text, never overwrites."
          />
          <Feature
            icon={Volume2}
            title="Read-aloud"
            body="Per-message play/stop with voice selection tuned for natural pacing."
          />
          <Feature
            icon={Layers}
            title="Auto-charted"
            body="Bar, line, or donut — the chart picks the right form for the data."
          />
          <Feature
            icon={Zap}
            title="Reduced-motion aware"
            body="Every animation respects prefers-reduced-motion at the Framer level."
          />
        </SubGrid>
      </Section>

      {/* ─────────── 08 — Stack ─────────── */}
      <Section
        index="08"
        title="Built with"
        kicker="Modern, boring-where-it-matters"
        icon={Database}
        intro={
          <>
            Every dependency earns its place. No wrappers around wrappers, no
            custom implementations of things the browser already provides.
          </>
        }
      >
        <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {STACK.map((s) => (
            <li
              key={s.name}
              className="flex flex-col gap-0.5 bg-card px-5 py-4"
            >
              <span className="text-sm font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.role}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ─────────── 09 — Links ─────────── */}
      <Section
        index="09"
        title="Links"
        kicker="Repo, profile, contact"
        icon={GitBranch}
        intro={
          <>
            Everything in one place. The repo is the primary source of truth.
          </>
        }
      >
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {LINKS.map(({ label, href, icon: Icon, primary }) => {
            const external = href.startsWith("http");
            return (
              <li key={href}>
                <a
                  href={href}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none ${
                    primary
                      ? "border-brand/40 bg-brand-soft hover:border-brand"
                      : "border-border bg-card hover:border-brand/40 hover:bg-accent/40"
                  }`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      primary
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <Icon className="size-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {href.replace(/^mailto:/, "")}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ─────────── CTA ─────────── */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className="mt-24 flex flex-col items-start gap-5 rounded-2xl border border-border bg-gradient-to-br from-brand-soft to-card p-8 sm:p-12"
      >
        <Sparkles className="size-6 text-brand" />
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ready to research something?
        </h2>
        <p className="max-w-xl text-sm leading-7 text-muted-foreground">
          Ask a question, watch the agents work, and read a report that shows
          every source they used.
        </p>
        <Link
          href="/research"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
        >
          <Sparkle size={15} weight="fill" />
          Start researching
        </Link>
      </motion.section>

      <footer className="mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-8 text-xs text-muted-foreground">
        <span>
          © {new Date().getFullYear()} Inquira — built by Sheharyar Sarmad.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Volume2 className="size-3.5" />
          Voice input &amp; output enabled
        </span>
      </footer>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Layout helpers                                                            */
/* -------------------------------------------------------------------------- */

function Section({
  index,
  title,
  kicker,
  intro,
  icon: Icon,
  children,
}: {
  index: string;
  title: string;
  kicker: string;
  intro: React.ReactNode;
  icon: PhosphorIcon | React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-100px" }}
      className="mt-28 sm:mt-32"
    >
      <div className="flex items-center gap-4">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon className="size-[20px]" />
        </span>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {index} · {kicker}
          </p>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h2>
        </div>
      </div>
      <div className="mt-6 max-w-3xl text-[14.5px] leading-8 text-muted-foreground [&_code]:text-foreground [&_em]:text-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {intro}
      </div>
      {children}
    </motion.section>
  );
}

function SubGrid({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon?: PhosphorIcon | React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-brand" />}
        <p className="text-[14px] font-medium">{title}</p>
      </div>
      <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}