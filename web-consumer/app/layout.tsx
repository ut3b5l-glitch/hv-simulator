import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import OnboardingGate from "@/components/OnboardingGate";
import PullToRefresh from "@/components/PullToRefresh";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import SplashScreen from "@/components/SplashScreen";

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
    statusBarStyle: "black-translucent",
    title: "Zokki",
    startupImage: [
      { url: "/icons/splash/apple-splash-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-1242x2208.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-1206x2622.png", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: "/icons/splash/apple-splash-1320x2868.png", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
    ],
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2c2a27",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={urbanist.variable} suppressHydrationWarning>
      {/* safe-bottom lives on <main>, not <body>: body is height-pinned to the
          viewport, so its padding can't extend the scrollable area and the last
          card would end up trapped under the floating nav. */}
      <body className="min-h-screen">
        <main className="safe-bottom relative z-10 mx-auto w-full max-w-screen-sm px-4 pt-[max(env(safe-area-inset-top),18px)]">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
        <BottomNav />
        <OnboardingGate />
        <ServiceWorkerRegister />
        <SplashScreen />
      </body>
    </html>
  );
}
