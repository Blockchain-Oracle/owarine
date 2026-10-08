"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { FluentArt } from "@/components/kit";
import type { CollageObject } from "@/components/kit";
import { cn } from "@/lib/utils";

/**
 * The landing's atoms (8 Oct, the "Rainbow" direction): its 4-point sparkle, floating 3D mascots, drifting sky blobs,
 * the tangerine / hot-pink CTA pebble with its white tile, and two motions adapted from 21st.dev — a word-by-word
 * reveal (tom_ui "Words Stagger") and cards that rise into view. Every motion stands still under reduced motion.
 */

/** Rainbow's 4-point star, drawn in currentColor. */
export function SparkleStar({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <path fill="currentColor" d="M12 0c.6 5.6 2.9 9.4 12 12-9.1 2.6-11.4 6.4-12 12-.6-5.6-2.9-9.4-12-12C9.1 9.4 11.4 5.6 12 0Z" />
    </svg>
  );
}

export interface SparkleSpot {
  x: number;
  y: number;
  size: number;
  delay: number;
  tone?: "yellow" | "pink" | "white";
}

/** A few sparkles scattered over a box, each twinkling on its own clock. */
export function Sparkles({ spots, className }: { spots: readonly SparkleSpot[]; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {spots.map((s, i) => (
        <span key={i} className={cn("lp-spark", s.tone === "pink" && "lp-spark-pink", s.tone === "white" && "lp-spark-white")} style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.delay}s` } as CSSProperties}>
          <SparkleStar size={s.size} />
        </span>
      ))}
    </div>
  );
}

export interface Mascot {
  name: CollageObject["name"];
  x: number;
  y: number;
  size: number;
  rotate?: number;
  delay?: number;
}

/** 3D objects floating at the edges of a section. */
export function Mascots({ items, className }: { items: readonly Mascot[]; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {items.map((m, i) => (
        <span key={`${m.name}-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
          <span className="lp-float block" style={{ "--lp-rot": `${m.rotate ?? 0}deg`, animationDelay: `${-(m.delay ?? i) * 1.4}s` } as CSSProperties}>
            <FluentArt name={m.name} size={m.size} />
          </span>
        </span>
      ))}
    </div>
  );
}

/** Soft colour blobs drifting behind a section (adapted from 21st "Floating Gradient"). */
export function Blobs({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <span className="lp-blob lp-blob-mint top-[8%] left-[4%] size-[22rem]" />
      <span className="lp-blob lp-blob-pink top-[35%] right-[2%] size-[26rem]" />
      <span className="lp-blob lp-blob-sky bottom-[-10%] left-[35%] size-[28rem]" />
    </div>
  );
}

/** A CTA pebble: tangerine or hot pink, white label, a white tile on the right carrying a mark. */
export function CandyCTA({ tone, href, onClick, tile, children, className }: { tone: "tangerine" | "pink" | "ghost"; href?: string; onClick?: () => void; tile?: ReactNode; children: ReactNode; className?: string }) {
  const cls = cn("lp-cta", tone === "tangerine" ? "lp-cta-tangerine" : tone === "pink" ? "lp-cta-pink" : "lp-cta-ghost", !tile && "pr-6", className);
  const body = (
    <>
      <span>{children}</span>
      {tile ? <span className="lp-tile">{tile}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} onClick={onClick} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

const words: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(0.5rem)" },
  visible: { opacity: 1, y: 0, filter: "blur(0rem)", transition: { type: "spring", stiffness: 260, damping: 24 } },
};

/**
 * A headline revealed word by word (adapted from 21st "Words Stagger" by tom_ui: blur, rise, fade). `lines` keeps the
 * designed line breaks; on scroll it plays once when in view, or at once (`now`) for the first screen.
 */
export function StaggerTitle({ lines, as = "h2", className, lineClassName, now = false, delay = 0 }: { lines: readonly string[]; as?: "h1" | "h2"; className?: string; lineClassName?: (i: number) => string | undefined; now?: boolean; delay?: number }) {
  const reduce = useReducedMotion();
  const Tag = as === "h1" ? motion.h1 : motion.h2;
  if (reduce) {
    const Plain = as;
    return (
      <Plain className={className}>
        {lines.map((l, i) => (
          <span key={l} className={cn("block", lineClassName?.(i))}>
            {l}
          </span>
        ))}
      </Plain>
    );
  }
  return (
    <Tag
      className={className}
      initial="hidden"
      {...(now ? { animate: "visible" } : { whileInView: "visible", viewport: { once: true, amount: 0.6 } })}
      variants={{ visible: { transition: { staggerChildren: 0.07, delayChildren: delay } } }}
      aria-label={lines.join(" ")}
    >
      {lines.map((l, i) => (
        <span key={l} className={cn("block", lineClassName?.(i))} aria-hidden>
          {l.split(" ").map((w, j, all) => (
            <Fragment key={`${w}-${j}`}>
              <motion.span className="inline-block" variants={words}>
                {w}
              </motion.span>
              {/* The space sits between the words, outside each inline-block, so it never collapses. */}
              {j < all.length - 1 ? " " : null}
            </Fragment>
          ))}
        </span>
      ))}
    </Tag>
  );
}

/** Children rise into view once, one after another (`index` staggers siblings). */
export function Rise({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 36, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ type: "spring", stiffness: 180, damping: 22, delay: index * 0.08 }}
    >
      {children}
    </motion.div>
  );
}

/** A section's small label and title, centred like Rainbow's openers. */
export function SectionHead({ kicker, lines, align = "center", className }: { kicker: string; lines: readonly string[]; align?: "center" | "left"; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", align === "center" ? "items-center text-center" : "items-start", className)}>
      <span className="lp-kicker lp-pill px-4 py-1.5">{kicker}</span>
      <StaggerTitle lines={lines} className="lp-display lp-h2" />
    </div>
  );
}
