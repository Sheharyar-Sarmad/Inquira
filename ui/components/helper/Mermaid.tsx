"use client";

import { useEffect, useId, useRef, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  Mermaid renderer                                                          */
/*                                                                            */
/*  Fixes the "diagram leaks into the top-left corner" bug:                   */
/*    Mermaid 11 appends a temp measurement <div> to <body> during render.    */
/*    Under React StrictMode, or when a render is superseded by a theme       */
/*    change, that removal doesn't happen and the fragment stays visible.     */
/*                                                                            */
/*  We pass a dedicated off-screen container as the third argument to         */
/*  `mermaid.render()` — Mermaid uses it instead of body. Even a leak is      */
/*  invisible because the container lives at (-10000, -10000).                */
/*                                                                            */
/*  Also uses a per-render sequence number so overlapping renders (StrictMode, */
/*  rapid theme toggles) can't race each other.                               */
/* -------------------------------------------------------------------------- */

type Theme = "light" | "dark";

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
const loadMermaid = () => {
  if (!mermaidPromise)
    mermaidPromise = import("mermaid").then((m) => m.default);
  return mermaidPromise;
};

const PALETTE: Record<Theme, Record<string, string>> = {
  dark: {
    primaryColor: "#141824",
    primaryTextColor: "#F8FAFC",
    primaryBorderColor: "#8B5CF6",
    lineColor: "#475569",
    secondaryColor: "#0D1018",
    tertiaryColor: "#07080D",
    background: "#07080D",
    mainBkg: "#141824",
    nodeBorder: "#8B5CF6",
    clusterBkg: "#0D1018",
    clusterBorder: "#334155",
    titleColor: "#F8FAFC",
    edgeLabelBackground: "#0D1018",
    textColor: "#F8FAFC",
    fontFamily: "var(--font-sans, ui-sans-serif)",
  },
  light: {
    primaryColor: "#F8FAFC",
    primaryTextColor: "#0F172A",
    primaryBorderColor: "#8B5CF6",
    lineColor: "#94A3B8",
    secondaryColor: "#F1F5F9",
    tertiaryColor: "#FFFFFF",
    background: "#FFFFFF",
    mainBkg: "#F8FAFC",
    nodeBorder: "#8B5CF6",
    clusterBkg: "#F1F5F9",
    clusterBorder: "#CBD5E1",
    titleColor: "#0F172A",
    edgeLabelBackground: "#FFFFFF",
    textColor: "#0F172A",
    fontFamily: "var(--font-sans, ui-sans-serif)",
  },
};

function useCurrentTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const root = document.documentElement;
    const read = () =>
      setTheme(root.classList.contains("dark") ? "dark" : "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

export default function Mermaid({
  chart,
  className,
  ariaLabel = "Architecture diagram",
}: {
  chart: string;
  className?: string;
  ariaLabel?: string;
}) {
  const reactId = useId();
  // React 19's useId can contain non-identifier characters — strip them so the
  // string is safe to use as a DOM id.
  const baseId = `mmd${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const theme = useCurrentTheme();
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const seq = ++seqRef.current;
    const renderId = `${baseId}-${seq}`;

    (async () => {
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
          fontFamily: "var(--font-sans, ui-sans-serif)",
          themeVariables: PALETTE[theme],
          flowchart: { curve: "basis", htmlLabels: true, useMaxWidth: false }, // ← was true
          sequence: { useMaxWidth: false, wrap: true }, // ← was true
        });

        const container = measureRef.current ?? undefined;
        const { svg: out } = await mermaid.render(renderId, chart, container);

        // Mermaid leaves its temp node inside the container when we supply
        // one. Clear it so re-renders don't accumulate stale SVGs.
        if (container) container.replaceChildren();

        // If a newer render has started, discard this result.
        if (cancelled || seq !== seqRef.current) return;

        setSvg(out);
        setFailed(false);
      } catch (err) {
        if (cancelled || seq !== seqRef.current) return;
        console.error("Mermaid render failed:", err);
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, baseId, theme]);

  if (failed) {
    return (
      <pre className="mt-6 overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 font-mono text-xs">
        {chart}
      </pre>
    );
  }

  return (
    <>
      {/*
        Off-screen measurement container.
        Positioned outside the viewport with zero opacity and no pointer
        events, so anything Mermaid writes into it — including leaked temp
        nodes — can never appear on screen.
      */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "fixed",
          top: "-10000px",
          left: "-10000px",
          width: "1600px",
          height: "1600px",
          overflow: "hidden",
          pointerEvents: "none",
          opacity: 0,
          zIndex: -1,
        }}
      />
      <div
        role="img"
        aria-label={ariaLabel}
        className={className}
        style={{ visibility: svg ? "visible" : "hidden" }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </>
  );
}
