"use client";

import dynamic from "next/dynamic";

const ThreeBG = dynamic(() => import("./ThreeBG"), {
  ssr: false,
});

export default function ThreeBGWrapper({ className }: { className?: string }) {
  return <ThreeBG className={className} />;
}