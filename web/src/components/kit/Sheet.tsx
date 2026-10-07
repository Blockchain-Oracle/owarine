"use client";

import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Every secondary page is a sheet over the live chart (Tradash); on a phone it is UGLYCASH's bottom sheet with a
 * grabber and swipe-to-dismiss, on desktop the same phone-sized sheet floats centred over the chart.
 *
 * Built on Base UI's Drawer (docs: node_modules/@base-ui/react/docs/react/components/drawer.md): `--drawer-swipe-*`
 * variables drive the drag, `data-starting-style` / `data-ending-style` the enter and exit, and the 3rem bleed under
 * the phone sheet keeps an overscroll from showing the page beneath it.
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
  /** `md` is the phone-width sheet; `lg` widens on desktop for tables. */
  size?: "md" | "lg";
  className?: string;
}

export function Sheet({ open, onOpenChange, trigger, title, hideTitle, description, children, footer, size = "md", className }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={(next) => onOpenChange?.(next)} swipeDirection="down">
      {trigger}
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-[9400] min-h-dvh bg-ow-black opacity-[calc(0.42*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[420ms] ease-ow-spring data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*380ms)] supports-[-webkit-touch-callout:none]:absolute" />
        <Drawer.Viewport className="fixed inset-0 z-[9400] flex items-end justify-center md:items-center md:p-6">
          <Drawer.Popup
            className={cn(
              "flex max-h-[calc(92dvh+3rem)] w-full flex-col overflow-hidden bg-ow-card text-ow-ink outline-none",
              "-mb-[3rem] rounded-t-ow-sheet pb-[calc(env(safe-area-inset-bottom,0rem)+3rem)]",
              "md:mb-0 md:max-h-(--ow-sheet-max-h) md:rounded-ow-sheet md:pb-0",
              size === "lg" ? "md:w-(--ow-sheet-w-lg)" : "md:w-(--ow-sheet-w)",
              "[transform:translateY(var(--drawer-swipe-movement-y))] transition-[transform,opacity] duration-[420ms] ease-ow-spring will-change-transform",
              "data-swiping:select-none data-starting-style:[transform:translateY(calc(100%-3rem+0.125rem))] data-ending-style:[transform:translateY(calc(100%-3rem+0.125rem))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*380ms)]",
              "md:data-starting-style:[transform:translateY(1.5rem)] md:data-starting-style:opacity-0 md:data-ending-style:[transform:translateY(1.5rem)] md:data-ending-style:opacity-0",
              "motion-reduce:transition-none",
              className,
            )}
          >
            <div aria-hidden className="mx-auto mt-2.5 h-1.25 w-10 shrink-0 rounded-full bg-ow-hairline md:hidden" />
            <header className={cn("flex shrink-0 items-start gap-3 px-6 pt-4 pb-2", hideTitle && "pb-0")}>
              <div className="min-w-0 flex-1">
                <Drawer.Title className={cn("ow-display ow-display-sm", hideTitle && "sr-only")}>{title}</Drawer.Title>
                {description ? <Drawer.Description className="ow-body mt-2 text-ow-label text-ow-muted">{description}</Drawer.Description> : null}
              </div>
              <Drawer.Close aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full bg-ow-recessed text-ow-ink transition-colors hover:bg-ow-hairline">
                <X className="size-4" strokeWidth={2.5} />
              </Drawer.Close>
            </header>
            <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-6">{children}</Drawer.Content>
            {footer ? <div className="shrink-0 border-t border-ow-hairline px-6 pt-4 pb-6">{footer}</div> : null}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Re-exported so a caller can place its own trigger inside the Root (`<Sheet trigger={<SheetTrigger … />}>`). */
export const SheetTrigger = Drawer.Trigger;
export const SheetClose = Drawer.Close;
