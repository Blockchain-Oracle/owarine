"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PLACES } from "../nav";

/** True while the user is typing somewhere, so single-key shortcuts stay out of the way. */
export function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** 1–6 jump between the places (roy-chain's keyboard map); never while typing or while a dialog or sheet is open. */
export function useNavKeys(): void {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat || typing(e.target)) return;
      const item = PLACES.find((p) => p.digit === e.key);
      if (!item || document.querySelector('[role="dialog"][data-open], [aria-modal="true"]')) return;
      e.preventDefault();
      router.push(item.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}
