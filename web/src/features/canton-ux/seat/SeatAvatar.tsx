"use client";

import { useId } from "react";

/** The brand's own inks; every seat's marble is three of them. */
const PALETTE = ["var(--ow-pink)", "var(--ow-sky)", "var(--ow-lime)", "var(--ow-cream)", "var(--ow-sky-deep)"] as const;
const SIZE = 80;

/** A stable 31-bit hash of the seat's address, so one seat always wears the same marble on every device. */
function hashOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

const digit = (n: number, place: number) => Math.floor((n / 10 ** place) % 10);
/** A value in `[0, range)`, negated when the seed's digit at `place` is even, so shapes drift both ways. */
const unit = (n: number, range: number, place?: number) => (place !== undefined && digit(n, place) % 2 === 0 ? -(n % range) : n % range);

/**
 * The seat's wallet avatar: a blurred marble of the brand inks, seeded by the seat's address (after boring-avatars'
 * "marble", MIT), in place of the lime number disc (Abu, 8 Oct). Same address, same marble, so a seat is recognisable
 * at a glance in the rail, the phone's top bar and the menu. Decorative: the seat's name sits beside it in words.
 */
export function SeatAvatar({ seed, size = 36, className }: { seed: string; size?: number; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const n = hashOf(seed);
  const shapes = [0, 1, 2].map((i) => {
    const m = n * (i + 1);
    return {
      fill: PALETTE[(n + i) % PALETTE.length],
      dx: unit(m, SIZE / 10, 1),
      dy: unit(m, SIZE / 10, 2),
      scale: 1.2 + unit(m, SIZE / 20) / 10,
      rotate: unit(m, 360, 1),
    };
  });
  const [base, first, second] = shapes as [(typeof shapes)[0], (typeof shapes)[0], (typeof shapes)[0]];
  return (
    <svg aria-hidden viewBox={`0 0 ${SIZE} ${SIZE}`} width={size} height={size} className={className} fill="none">
      <mask id={`${id}m`} maskUnits="userSpaceOnUse" x={0} y={0} width={SIZE} height={SIZE}>
        <rect width={SIZE} height={SIZE} rx={SIZE * 2} fill="white" />
      </mask>
      <g mask={`url(#${id}m)`}>
        <rect width={SIZE} height={SIZE} fill={base.fill} />
        <path
          filter={`url(#${id}b)`}
          d="M32.414 59.35L50.376 70.5H72.5v-71H33.728L26.5 13.381l19.057 27.08L32.414 59.35z"
          fill={first.fill}
          transform={`translate(${first.dx} ${first.dy}) rotate(${first.rotate} ${SIZE / 2} ${SIZE / 2}) scale(${second.scale})`}
        />
        <path
          filter={`url(#${id}b)`}
          style={{ mixBlendMode: "overlay" }}
          d="M22.216 24L0 46.75l14.108 38.129L78 86l-3.081-59.276-22.378 4.005 12.972 20.186-23.35 27.395L22.215 24z"
          fill={second.fill}
          transform={`translate(${second.dx} ${second.dy}) rotate(${second.rotate} ${SIZE / 2} ${SIZE / 2}) scale(${second.scale})`}
        />
      </g>
      <defs>
        <filter id={`${id}b`} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity={0} result="clear" />
          <feBlend in="SourceGraphic" in2="clear" result="shape" />
          <feGaussianBlur stdDeviation={7} result="blur" />
        </filter>
      </defs>
    </svg>
  );
}
