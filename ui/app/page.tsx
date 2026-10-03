import HomeHero from "@/components/layout/HomeHero";
import type { Metadata } from "next";

export const metadata: Metadata = {
  openGraph: {
    images: [
      {
        url: "/meta-home-banner.png",
        width: 1664,
        height: 1024,
        alt: "Inquira — AI Research Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/meta-home-banner.png"],
  },
};

export default function Home() {
  return (
    <main>
      <HomeHero />
    </main>
  );
}