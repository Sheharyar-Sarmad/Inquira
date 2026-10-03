"use client";

import { useEffect, useRef } from "react";
import { Mic } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "./Voice";

/** Dictation button: appends the spoken transcript to `value` via `onText`. Renders nothing if unsupported. */
export default function MicButton({
  value,
  onText,
  disabled,
  className,
}: {
  value: string;
  onText: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const base = useRef("");
  const { supported, listening, error, start, stop, clearError } = useSpeechRecognition((t) =>
    onText((base.current ? `${base.current.trimEnd()} ` : "") + t),
  );

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4500);
    return () => clearTimeout(t);
  }, [error, clearError]);

  if (!supported) return null;

  return (
    <span className="relative">
      {error && (
        <span role="alert" className="absolute right-0 bottom-full mb-2 w-max max-w-64 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-destructive shadow-md">
          {error}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop voice input" : "Start voice input"}
        title={listening ? "Stop listening" : "Speak your question"}
        onClick={() => {
          if (listening) return stop();
          base.current = value;
          start();
        }}
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors",
          "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none disabled:opacity-40",
          listening && "border-brand/50 bg-brand-soft text-brand",
          className,
        )}
      >
        {listening && <span aria-hidden className="absolute inset-0 rounded-lg ring-2 ring-brand/40 motion-safe:animate-ping" />}
        <Mic className="relative size-[17px]" />
      </button>
      <span role="status" className="sr-only">{listening ? "Listening" : ""}</span>
    </span>
  );
}