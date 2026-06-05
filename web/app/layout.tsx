import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

// Urbanist — geometric, rounded sans that anchors the Zokki visual identity.
const urbanist = Urbanist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-urbanist",
});

export const metadata: Metadata = {
  title: "Zokki",
  description: "Zokki — Happy Valley & Sha Tin racing model: predictions, value bets, performance.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zokki",
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#eef5f2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={urbanist.variable} suppressHydrationWarning>
      <body className="min-h-screen safe-bottom">
        <main className="relative z-10 mx-auto w-full max-w-screen-sm px-4 pt-[max(env(safe-area-inset-top),18px)]">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
