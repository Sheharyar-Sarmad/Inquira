import type { Metadata } from "next";
import { Suspense } from "react";
import ChatClient from "@/components/layout/ChatClient";

export const metadata: Metadata = {
  openGraph: {
    title: "Research — Inquira",
    description: "Research, analyze, and discover evidence with Inquira.",
    type: "website",
    images: [
      {
        url: "/meta-research-banner.png",
        width: 1664,
        height: 1024,
        alt: "Inquira Research",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Research — Inquira",
    description: "Research, analyze, and discover evidence with Inquira.",
    images: ["/meta-research-banner.png"],
  },
};

// useSearchParams() in ChatClient requires a Suspense boundary.
export default function ResearchPage() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <ChatClient />
    </Suspense>
  );
}