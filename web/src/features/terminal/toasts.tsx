"use client";

import { CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * The trading screen's toasts, to Tradash's (SPEC-flow §8 "Toast system"): top-centre, at most 3, spring in from above;
 * success 3.5 s ✓, error 5 s ⚠, info 3.5 s ⓘ, loading persistent with a spinner; a toast with the same id replaces the
 * one shown (so "Opening Up BTC…" becomes "Up BTC opened"); `confetti` bursts from both bottom corners on a win.
 */
export type ToastKind = "success" | "error" | "info" | "loading";

export interface TradeToast {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  confetti?: boolean;
  /** A button on the toast (the updater's Refresh). */
  action?: { label: string; run: () => void };
  /** Stays until dismissed, like a loading toast but closable. */
  persistent?: boolean;
}

const LIFETIME: Record<Exclude<ToastKind, "loading">, number> = { success: 3_500, error: 5_000, info: 3_500 };
const MAX = 3;

let toasts: Array<TradeToast & { at: number }> = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let seq = 0;

function emit(): void {
  listeners.forEach((l) => l());
}

export function dismissToast(id: string): void {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

/** Shows a toast; the same id replaces the one already shown. Returns the id. */
export function toast(t: Omit<TradeToast, "id"> & { id?: string }): string {
  const id = t.id ?? `t${++seq}`;
  const prev = timers.get(id);
  if (prev) clearTimeout(prev);
  const entry = { ...t, id, at: Date.now() };
  const exists = toasts.some((x) => x.id === id);
  toasts = exists ? toasts.map((x) => (x.id === id ? entry : x)) : [entry, ...toasts].slice(0, MAX);
  if (t.kind !== "loading" && !t.persistent) timers.set(id, setTimeout(() => dismissToast(id), LIFETIME[t.kind]));
  emit();
  return id;
}

const ICON = { success: CircleCheck, error: TriangleAlert, info: Info, loading: LoaderCircle } as const;
const TONE: Record<ToastKind, string> = { success: "text-ow-up", error: "text-ow-down", info: "text-ow-muted", loading: "text-ow-muted" };

export function TradeToasts() {
  const list = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => toasts,
    () => toasts,
  );
  const reduce = useReducedMotion();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0rem)+0.75rem)] z-[9500] flex flex-col items-center gap-2 px-4">
      <AnimatePresence initial={false}>
        {list.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }}
              transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto relative w-full max-w-sm rounded-ow-card border border-ow-hairline bg-ow-card px-4 py-3 text-ow-ink"
            >
              {t.confetti && !reduce ? <Confetti /> : null}
              <div className="relative flex items-start gap-3">
                <Icon className={cn("mt-0.5 size-5 shrink-0", TONE[t.kind], t.kind === "loading" && "animate-spin")} strokeWidth={2.25} />
                <div className="min-w-0 flex-1">
                  <p className="text-ow-body font-semibold">{t.title}</p>
                  {t.description ? <p className="text-ow-caption text-ow-muted">{t.description}</p> : null}
                </div>
                {t.action ? (
                  <button type="button" onClick={t.action.run} className="h-8 shrink-0 self-center rounded-full bg-ow-ink px-3 text-ow-caption font-bold text-ow-inverse">
                    {t.action.label}
                  </button>
                ) : null}
                {t.kind !== "loading" ? (
                  <button type="button" aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="grid size-6 place-items-center rounded-full text-ow-muted hover:text-ow-ink">
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Two emitters at 18 % and 82 % of the width, 34 particles each, gravity and drag, 1.1 s, fading after half. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const cs = getComputedStyle(canvas);
    const colours = ["--ow-up-line", "--ow-pink", "--ow-lime", "--ow-sky", "--ow-white"].map((v) => cs.getPropertyValue(v).trim() || "currentColor");
    const parts = [0.18, 0.82].flatMap((fx) =>
      Array.from({ length: 34 }, () => {
        const speed = 3.6 + Math.random() * 3.4;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.9 + (fx < 0.5 ? -0.42 : 0.42);
        return { x: rect.width * fx, y: rect.height * 0.86, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, w: 4 + Math.random() * 4, h: 6 + Math.random() * 6, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, drag: 0.982 + Math.random() * 0.012, c: colours[Math.floor(Math.random() * colours.length)]! };
      }),
    );
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - start) / 1100;
      ctx.clearRect(0, 0, rect.width, rect.height);
      if (t >= 1) return;
      ctx.globalAlpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
      for (const p of parts) {
        p.vy += 0.14;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 h-[calc(100%+8rem)] w-full" />;
}
