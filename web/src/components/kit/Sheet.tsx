"use client";

import { Drawer } from "@base-ui/react/drawer";
import { ChevronLeft, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Every secondary page is a sheet over the live chart, to Tradash's sheet (TRADASH-FIDELITY.md §Shell): one bottom
 * sheet at every width — at most 28rem wide and centred, 50 px top radius, at least half the screen tall — with an accent
 * grab bar, a small centred title, an optional back or left slot, a round ✕, a black/50 backdrop and drag-to-dismiss.
 *
 * Built on Base UI's Drawer (docs: node_modules/@base-ui/react/docs/react/components/drawer.md): `--drawer-swipe-*`
 * variables drive the drag, `data-starting-style` / `data-ending-style` the enter and exit, and the 3rem bleed under
 * the sheet keeps an overscroll from showing the page beneath it.
 */
export interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The element that opens the sheet; omit when `open` is controlled. */
  trigger?: ReactNode;
  title: ReactNode;
  /** Hide the title visually (it stays the dialog's accessible name). */
  hideTitle?: boolean;
  description?: ReactNode;
  children: ReactNode;
  /** A footer pinned under the scrolling body (the Confirm pill, Swipe to confirm). */
  footer?: ReactNode;
  /** `md` is Tradash's 28rem; `lg` widens to 40rem for tables. */
  size?: "md" | "lg";
  /** A back arrow on the left of the header. */
  onBack?: () => void;
  /** Anything else on the left of the header (a gear, a search). */
  headerLeft?: ReactNode;
  className?: string;
}

export function Sheet({ open, onOpenChange, trigger, title, hideTitle, description, children, footer, size = "md", onBack, headerLeft, className }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(next) => onOpenChange?.(next)} swipeDirection="down">
      {trigger}
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-[9400] min-h-dvh bg-ow-black opacity-[calc(0.5*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[420ms] ease-ow-spring data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[250ms] supports-[-webkit-touch-callout:none]:absolute" />
        <Drawer.Viewport className="fixed inset-0 z-[9400] flex items-end justify-center">
          <Drawer.Popup
            className={cn(
              "flex w-full flex-col overflow-hidden bg-ow-card text-ow-ink outline-none",
              size === "lg" ? "max-w-[40rem]" : "max-w-[28rem]",
              "-mb-[3rem] min-h-[calc(50dvh+3rem)] max-h-[calc(96dvh-env(safe-area-inset-top,0rem)-0.75rem+3rem)] rounded-t-[3.125rem] pb-[calc(env(safe-area-inset-bottom,0rem)+3rem)]",
              "[transform:translateY(var(--drawer-swipe-movement-y))] transition-[transform] duration-[420ms] ease-ow-spring will-change-transform",
              "data-swiping:select-none data-starting-style:[transform:translateY(calc(100%-3rem+0.125rem))] data-ending-style:[transform:translateY(calc(100%-3rem+0.125rem))] data-ending-style:duration-[250ms] data-ending-style:ease-in",
              "motion-reduce:transition-none",
              className,
            )}
          >
            <div aria-hidden className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-ow-pink" />
            <header className="grid shrink-0 grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2 px-5 pt-3 pb-1">
              <div className="flex">
                {onBack ? (
                  <button type="button" aria-label="Back" onClick={onBack} className="grid size-9 place-items-center rounded-full bg-ow-recessed text-ow-ink transition-colors hover:bg-ow-hairline">
                    <ChevronLeft className="size-4" strokeWidth={2.5} />
                  </button>
                ) : (
                  headerLeft
                )}
              </div>
              <Drawer.Title className={cn("truncate text-center text-ow-label font-semibold text-ow-muted", hideTitle && "sr-only")}>{title}</Drawer.Title>
              <Drawer.Close aria-label="Close" className="grid size-9 place-items-center justify-self-end rounded-full bg-ow-recessed text-ow-ink transition-colors hover:bg-ow-hairline">
                <X className="size-4" strokeWidth={2.5} />
              </Drawer.Close>
            </header>
            {description ? <Drawer.Description className="ow-body px-6 text-center text-ow-label text-ow-muted">{description}</Drawer.Description> : null}
            <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-6">{children}</Drawer.Content>
            {footer ? <div className="shrink-0 border-t border-ow-hairline px-5 pt-4 pb-6">{footer}</div> : null}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Re-exported so a caller can place its own trigger inside the Root (`<Sheet trigger={<SheetTrigger … />}>`). */
export const SheetTrigger = Drawer.Trigger;
export const SheetClose = Drawer.Close;
