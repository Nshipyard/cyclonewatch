"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// phc_ is a write-only client key: safe in client bundles.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "phc_BMsfAki62bqjmLKX6xVSK9GErSyMV2SKfEEBhKLckjSm";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.posthog.com";

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __nshipyard_ph?: boolean };
    if (w.__nshipyard_ph) return;
    w.__nshipyard_ph = true;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: "history_change",
      autocapture: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
    });
  }, []);
  return <>{children}</>;
}
