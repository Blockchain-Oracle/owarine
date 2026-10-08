"use client";

import { useEffect, useRef } from "react";
import type { TradeMode } from "@/features/terminal/mode";

/** The account context as the environment names it: the guest demo, or a seat on Canton DevNet. */
export type EnvironmentMode = "demo" | "devnet";

export const environmentOf = (mode: TradeMode): EnvironmentMode => (mode === "live" ? "devnet" : "demo");

/** The control a change floods out from (the rail's seat row, or the phone's avatar), whichever is on screen. */
function floodOrigin(): DOMRect | null {
  for (const el of document.querySelectorAll<HTMLElement>("[data-flood-origin]")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

/**
 * Paints the new environment, flooding it out from the seat control through a view transition (roy-chain's
 * `mode-switch.client.tsx` flood, D100); instant without view transitions or with reduced motion.
 */
function flood(to: EnvironmentMode): void {
  const root = document.documentElement;
  const paint = () => root.setAttribute("data-mode", to);
  const r = floodOrigin();
  if (r) {
    root.style.setProperty("--flood-x", `${Math.round(r.left + r.width / 2)}px`);
    root.style.setProperty("--flood-y", `${Math.round(r.top + r.height / 2)}px`);
  }
  if (typeof document.startViewTransition !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paint();
    return;
  }
  root.classList.add("mode-flooding");
  void document.startViewTransition(paint).finished.finally(() => root.classList.remove("mode-flooding"));
}

/**
 * Keeps `<html data-mode>` on the account context while the shell is mounted. The first paint already has it (the
 * theme init script reads the stored seat). While a held seat is still being restored (`settling`) nothing changes, so a
 * returning seat never flashes the demo colours; the first settled answer corrects the guess at once; a later change,
 * taking a seat or resetting it, floods. The landing has no shell, so leaving takes the attribute off.
 */
export function useEnvironment(mode: EnvironmentMode, settling: boolean): void {
  const settledOnce = useRef(false);
  useEffect(() => {
    if (settling) return;
    const root = document.documentElement;
    const current = root.getAttribute("data-mode");
    if (!settledOnce.current || current === null) root.setAttribute("data-mode", mode);
    else if (current !== mode) flood(mode);
    settledOnce.current = true;
  }, [mode, settling]);
  useEffect(() => () => document.documentElement.removeAttribute("data-mode"), []);
}
