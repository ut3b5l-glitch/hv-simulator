import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";
import { getDict, getLocale } from "@/lib/i18n";
import CursorGlow from "@/components/CursorGlow";

// Urbanist — geometric, rounded sans that anchors the Zokki visual identity.
const urbanist = Urbanist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-urbanist",
});

const TITLE = "Zokki — Read every Hong Kong race in ten seconds";
const DESC =
  "A transparent race-reading companion for Happy Valley & Sha Tin. Plain-English previews, a model-ranked shortlist, and an honest public scorecard you can check. Information & entertainment only — not a betting service.";

export const metadata: Metadata = {
  metadataBase: new URL("https://zokki.app"),
  title: TITLE,
  description: DESC,
  applicationName: "Zokki",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: TITLE,
    description:
      "Plain-English previews, a model-ranked shortlist, and an honest public scorecard. Not a tipping service.",
    siteName: "Zokki",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zokki",
    description: "Read every Hong Kong race in ten seconds.",
  },
};

export const viewport: Viewport = {
  themeColor: "#eef5f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = getDict(getLocale()).htmlLang;
  return (
    <html lang={lang} data-theme="light" className={urbanist.variable}>
      <body className="min-h-screen antialiased">
        {/* Without JS the scroll observer never fires, so force every reveal to
            its visible state — no-JS visitors and crawlers see the full page. */}
        <noscript>
          <style>{".reveal{opacity:1 !important;transform:none !important}"}</style>
        </noscript>
        {/* Ambient depth layers — fixed, behind the z-10 page content. */}
        <div className="aurora" aria-hidden />
        <CursorGlow />
        {children}
      </body>
    </html>
  );
}
