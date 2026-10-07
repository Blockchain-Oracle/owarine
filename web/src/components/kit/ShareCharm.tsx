import type { ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Seal } from "./Seal";

/**
 * The PnL share card as a keychain charm (UGLYCASH): a cream tag hanging from a ring, the call in condensed caps, the
 * result huge, the seal in the corner. Rendered as DOM so the app can snapshot it (react-native-view-shot) and web can
 * draw the same layout to a canvas for the OG image. `forwardRef` lets a caller capture the node.
 */
export interface ShareCharmProps {
  /** "BTC UP 5M" */
  call: ReactNode;
  /** "+$12.40" or "+184%" — the caller decides which to brag with. */
  result: ReactNode;
  win: boolean;
  handle?: string;
  footnote?: ReactNode;
  className?: string;
}

export const ShareCharm = forwardRef<HTMLDivElement, ShareCharmProps>(function ShareCharm({ call, result, win, handle, footnote, className }, ref) {
  return (
    <div ref={ref} data-slot="share-charm" className={cn("relative mx-auto flex w-75 flex-col items-center pt-10", className)}>
      {/* the ring and its chain */}
      <svg aria-hidden width="64" height="56" viewBox="0 0 64 56" className="absolute top-0">
        <circle cx="32" cy="18" r="15" fill="none" stroke="var(--ow-chain)" strokeWidth="5" />
        <rect x="29" y="32" width="6" height="24" rx="3" fill="var(--ow-chain)" />
      </svg>
      <div className="relative w-full rotate-[-3deg] rounded-ow-sheet bg-ow-cream px-7 pt-9 pb-7 text-ow-black outline-3 outline-ow-white outline-solid">
        <span aria-hidden className="absolute top-3.5 left-1/2 size-4 -translate-x-1/2 rounded-full bg-ow-canvas outline-2 outline-ow-black/15 outline-solid" />
        <p className="ow-display text-ow-display">{call}</p>
        <p className={cn("ow-display mt-3 text-ow-charm", win ? "text-ow-win" : "text-ow-lose")}>{result}</p>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="ow-body text-ow-caption font-semibold text-ow-black/60">
            {handle ? <p className="text-ow-black">${handle}</p> : null}
            {footnote ? <p>{footnote}</p> : <p>Private on Canton</p>}
          </div>
          <Seal size={54} tone="black" />
        </div>
      </div>
    </div>
  );
});
