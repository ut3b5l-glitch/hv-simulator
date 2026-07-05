"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadPrefs } from "@/lib/prefs";

/**
 * First-launch gate: a visitor with no race-night profile is taken through
 * onboarding once. Runs client-side after hydration (prefs live in
 * localStorage); returning users never see a flash because the redirect only
 * fires when prefs are absent.
 */
export default function OnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname.startsWith("/onboarding")) return;
    if (!loadPrefs()) router.replace("/onboarding");
  }, [pathname, router]);

  return null;
}
