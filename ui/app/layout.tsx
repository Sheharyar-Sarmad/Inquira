import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import SideBar from "@/components/navigation/SideBar";
import ThreeBG from "@/components/animation/ThreeBG";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Runs before first paint so the saved (or system) theme is applied with no flash.
const themeScript = `(function(){try{var t=localStorage.getItem('inquira:theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

const DESCRIPTION =
  "AI-powered multi-agent research for intelligent source discovery and evidence-based reports.";

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: {
    default: "Inquira — AI Research Intelligence",
    template: "%s · Inquira",
  },
  description: DESCRIPTION,
  applicationName: "Inquira",
  authors: [{ name: "Sheharyar Sarmad", url: "https://github.com/Sheharyar-Sarmad" }],
  creator: "Sheharyar Sarmad",
  publisher: "Inquira",

  /* ---------------------------------------------------------------------- */
  /*  Icons — order matters. Modern browsers pick the first supported type.  */
  /*  Files must live in /public.                                            */
  /* ---------------------------------------------------------------------- */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png", sizes: "192x192" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/logo.svg",
        color: "#8B5CF6",
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /*  iOS home-screen support                                               */
  /* ---------------------------------------------------------------------- */
  appleWebApp: {
    capable: true,
    title: "Inquira",
    statusBarStyle: "black-translucent",
  },

  /* ---------------------------------------------------------------------- */
  /*  Social previews — logo will appear on Twitter, LinkedIn, Slack, etc.  */
  /* ---------------------------------------------------------------------- */
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Inquira",
    title: "Inquira — AI Research Intelligence",
    description: DESCRIPTION,
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Inquira",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Inquira — AI Research Intelligence",
    description: DESCRIPTION,
    images: ["/logo.png"],
  },

  /* ---------------------------------------------------------------------- */
  /*  Search-engine / crawler hints                                         */
  /* ---------------------------------------------------------------------- */
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#07080D" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: required if you add a class-based theme switcher (next-themes) later.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Column on mobile/tablet (top bar above content), row on xl+ (sidebar beside content). */}
      <body className="flex min-h-dvh flex-col xl:flex-row">
        {/* Global backdrop: one WebGL context for the whole app, behind all content.
            Pages must keep transparent backgrounds for it to show through. */}
        <ThreeBG className="pointer-events-none fixed inset-0 -z-10 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_80%)]" />
        <TooltipProvider delay={150}>
          <SideBar />
          {/* A <div>, not <main>: pages already render their own <main>. */}
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </TooltipProvider>
      </body>
    </html>
  );
}