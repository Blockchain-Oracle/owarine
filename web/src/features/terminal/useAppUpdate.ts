"use client";

import { useEffect } from "react";
import { toast } from "./toasts";

const CHECK_MS = 5 * 60_000;
const RUNNING = process.env.NEXT_PUBLIC_BUILD_ID ?? null;

/**
 * Tradash's PWA updater (`aU`; SPEC-flow §8): a persistent "New version available" toast with Refresh. Tradash's comes
 * from its service worker; Owarine has none, so the screen asks the server which build it runs — every five minutes
 * and whenever the tab comes back — and offers Refresh once that differs from the build this page was loaded from.
 */
export function useAppUpdate(): void {
  useEffect(() => {
    if (!RUNNING) return;
    let shown = false;
    const check = async () => {
      if (shown || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { build } = (await res.json()) as { build: string | null };
        if (!build || build === RUNNING) return;
        shown = true;
        toast({ id: "app-update", kind: "info", persistent: true, title: "New version available", description: "Refresh to get the latest Owarine.", action: { label: "Refresh", run: () => window.location.reload() } });
      } catch {
        // Offline or mid-deploy: the next check asks again.
      }
    };
    const timer = setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
}
