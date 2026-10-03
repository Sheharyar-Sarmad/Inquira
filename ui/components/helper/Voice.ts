"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ----------------------------------------------------------------------------
 * Voice input (speech-to-text) and output (text-to-speech) on top of the
 * browser's Web Speech API. No servers, no keys, no extra dependencies.
 * Support: recognition = Chrome / Edge / Safari (not Firefox); synthesis = all major browsers.
 * -------------------------------------------------------------------------- */

/* ------------------------------ Recognition ------------------------------- */

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionLike;

const getRecognition = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const RECOGNITION_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
  "no-speech": "I didn't catch that. Try again.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs an internet connection.",
};

/** `onText` receives the full transcript so far (final + interim) for the current utterance. */
export function useSpeechRecognition(onText: (transcript: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const cb = useRef(onText);

  useEffect(() => {
    cb.current = onText;
  });

  useEffect(() => {
    setSupported(!!getRecognition());
    return () => recRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      cb.current((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") setError(RECOGNITION_ERRORS[e.error] ?? "Voice input failed. Please try again.");
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);
  const clearError = useCallback(() => setError(null), []);

  return { supported, listening, error, start, stop, clearError };
}

/* -------------------------------- Synthesis -------------------------------- */

/** Turn markdown into something that sounds right when read aloud. */
export function markdownToSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " (code omitted). ")
    .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, "")
    .replace(/^\s*\|(.+)\|\s*$/gm, (_, row: string) => row.split("|").map((s) => s.trim()).filter(Boolean).join(", ") + ".")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/(\*\*|__|\*)/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Chrome silently cuts off long utterances, so read in sentence-sized chunks. */
function toChunks(text: string, max = 200): string[] {
  const out: string[] = [];
  for (let s of text.split(/(?<=[.!?])\s+/)) {
    while (s.length > max) {
      const cut = s.lastIndexOf(" ", max);
      const at = cut > 40 ? cut : max;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

/** Prefer neural / natural voices in the user's language; fall back to whatever exists. */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const locale = (navigator.language || "en-US").toLowerCase();
  const base = locale.split("-")[0];
  const inLang = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const pool = inLang.length ? inLang : voices;
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    return (
      (/natural|neural|online/.test(n) ? 6 : 0) +
      (/google|samantha|aria|jenny|guy|ava|allison|serena|daniel|karen|moira/.test(n) ? 3 : 0) +
      (v.lang.toLowerCase() === locale ? 2 : 0) +
      (v.localService ? 0 : 1) +
      (v.default ? 1 : 0)
    );
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(1);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const rateRef = useRef(1);
  const tokenRef = useRef(0);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    setSupported(true);
    const load = () => (voicesRef.current = window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      tokenRef.current++;
      window.speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    tokenRef.current++;
    window.speechSynthesis.cancel();
    setActiveId(null);
    setPaused(false);
  }, []);

  const speak = useCallback(
    (id: string, markdown: string) => {
      if (!("speechSynthesis" in window)) return;
      stop();
      const chunks = toChunks(markdownToSpeech(markdown));
      if (!chunks.length) return;
      const token = ++tokenRef.current;
      const voice = pickVoice(voicesRef.current);
      setActiveId(id);
      let i = 0;
      const next = () => {
        if (token !== tokenRef.current) return;
        if (i >= chunks.length) return setActiveId(null);
        const u = new SpeechSynthesisUtterance(chunks[i++]);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        }
        u.rate = rateRef.current;
        u.onend = next;
        u.onerror = (e) => {
          if (e.error !== "canceled" && e.error !== "interrupted") setActiveId(null);
        };
        window.speechSynthesis.speak(u);
      };
      next();
    },
    [stop],
  );

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setPaused(false);
  }, []);
  const setRate = useCallback((r: number) => {
    rateRef.current = r;
    setRateState(r); // applies from the next sentence
  }, []);

  return { supported, activeId, paused, rate, speak, pause, resume, stop, setRate };
}