import type { Metadata } from "next";
import AboutClient from "@/components/layout/AboutClient";

export const metadata: Metadata = {
  title: "Inside Inquira — Research that shows its work",
  description:
    "How Inquira works end to end: a two-agent research pipeline, async job API, human-in-the-loop approvals, voice in and voice out, and beautiful charted reports.",
  openGraph: {
    title: "Inside Inquira",
    description:
      "Agentic research, async job model, human-in-the-loop approvals. The full architecture, explained.",
    type: "website",
    images: [
      {
        url: "/meta-about-banner.png",
        width: 1664,
        height: 1024,
        alt: "Inside Inquira — AI research architecture",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Inside Inquira",
    description:
      "Agentic research, async job model, human-in-the-loop approvals. The full architecture, explained.",
    images: ["/meta-about-banner.png"],
  },
};

export default function AboutPage() {
  return <AboutClient />;
}