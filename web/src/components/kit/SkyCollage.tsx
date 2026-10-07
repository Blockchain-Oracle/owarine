import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { FLUENT, type FluentName } from "@/lib/art/fluent";
import { cn } from "@/lib/utils";

/**
 * One Fluent Emoji 3D object (MIT, Microsoft; public/art/fluent/SOURCES.md). UGLYCASH photographs cut-out objects on
 * a sky; ours are licence-clean 3D renders, used the same way.
 */
export function FluentArt({ name, size = 96, className, style, priority, alt = "" }: { name: FluentName; size?: number; className?: string; style?: CSSProperties; priority?: boolean; alt?: string }) {
  const art = FLUENT[name];
  return <Image src={art.src} width={size} height={Math.round((size * art.h) / art.w)} alt={alt} priority={priority} className={cn("pointer-events-none select-none", className)} style={style} draggable={false} />;
}

export interface CollageObject {
  name: FluentName;
  /** Position of the object's centre, in % of the collage box. */
  x: number;
  y: number;
  size: number;
  rotate?: number;
  /** Drift gently (off under reduced motion). The number staggers the phase. */
  float?: number;
}

/**
 * UGLYCASH's sky: a saturated blue that pales toward the horizon, soft cloud shapes drawn in SVG, and objects floating
 * in it. Children sit above the sky (headlines, a phone, stickers).
 */
export function SkyCollage({ objects = [], children, className, clouds = true }: { objects?: readonly CollageObject[]; children?: ReactNode; className?: string; clouds?: boolean }) {
  return (
    <div data-slot="sky" className={cn("relative isolate overflow-hidden bg-(image:--ow-sky-gradient) text-ow-black", className)}>
      {clouds ? <Clouds /> : null}
      {objects.map((o, i) => (
        <div
          key={`${o.name}-${i}`}
          aria-hidden
          className={cn("absolute -translate-x-1/2 -translate-y-1/2", o.float !== undefined && "ow-float")}
          style={{ left: `${o.x}%`, top: `${o.y}%`, rotate: `${o.rotate ?? 0}deg`, animationDelay: o.float !== undefined ? `${-o.float * 1.3}s` : undefined }}
        >
          <FluentArt name={o.name} size={o.size} />
        </div>
      ))}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Three cumulus shapes, white at varying opacity, drawn once and stretched to the box. */
function Clouds() {
  return (
    <svg aria-hidden className="absolute inset-0 -z-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
      <g fill="white">
        <path opacity="0.9" d="M-40 690c40-70 140-90 200-50 30-80 160-110 230-40 40-50 150-40 170 40 70-10 120 40 110 100H-60c-10-20 0-40 20-50z" />
        <path opacity="0.75" d="M760 720c20-60 100-80 150-40 30-70 140-90 200-30 50-30 130 0 130 70 40 10 50 50 30 80H740c-20-30-10-60 20-80z" />
        <path opacity="0.55" d="M820 150c20-40 80-50 110-20 20-50 100-60 140-10 40-10 80 20 70 60H800c-10-20 0-30 20-30z" />
        <path opacity="0.45" d="M90 210c15-35 70-45 95-15 20-40 85-45 115-5 35-5 60 20 55 50H75c-5-15 0-25 15-30z" />
      </g>
    </svg>
  );
}
