import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowLeft, SearchX } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found — Inquira",
};

// Server component: no client JS. Entrance uses tw-animate-css utilities.
// Renders inside the root layout, so the sidebar / mobile header stay visible.
export default function NotFound() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* Oversized ghost numeral – decorative only */}
      <span
        aria-hidden
        className="pointer-events-none absolute select-none text-[min(38vw,22rem)] leading-none font-semibold tracking-tighter text-foreground/[0.04]"
      >
        404
      </span>

      <div className="relative flex max-w-md flex-col items-center gap-5 animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* Inquira logo */}
        <div className="mb-2 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="Inquira"
            width={180}
            height={48}
            priority
            className="h-10 w-auto object-contain"
          />
        </div>

        <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-brand-soft text-brand">
          <SearchX className="size-6" aria-hidden />
        </span>

        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Error 404
        </p>

        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          This page isn&apos;t in the index
        </h1>

        <p className="text-balance text-base leading-relaxed text-muted-foreground">
          We searched our sources and couldn&apos;t find what you were looking
          for. It may have moved, or the link might be wrong.
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Start a research
          </Link>

          <Link
            href="/About"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
          >
            Learn about Inquira
          </Link>
        </div>
      </div>
    </main>
  );
}