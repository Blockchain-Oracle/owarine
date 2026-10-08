"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * shadcn's `command` (cmdk inside a Base UI dialog), as roy-chain carries it, on Owarine's tokens: a centred card a
 * third of the way down, a pill search field, rounded rows that fill grey when picked.
 */
export function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn("flex size-full flex-col overflow-hidden text-ow-ink", className)} {...props} />;
}

export function CommandDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[9500] bg-ow-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          data-slot="command-dialog"
          className="fixed top-[min(18dvh,9rem)] left-1/2 z-[9500] w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-[1.75rem] bg-ow-card p-2 text-ow-ink outline-none ring-1 ring-ow-hairline transition-[scale,opacity] duration-150 data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0"
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-12 items-center gap-2.5 rounded-full bg-ow-recessed px-4 ring-ow-pink-ink has-focus-visible:ring-2">
      <Search aria-hidden className="size-4.5 shrink-0 text-ow-muted" strokeWidth={2.5} />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn("ow-body h-full w-full bg-transparent text-ow-lead outline-none placeholder:text-ow-muted focus-visible:outline-none", className)}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-[min(26rem,60dvh)] scroll-py-2 overflow-x-hidden overflow-y-auto overscroll-contain px-1 pt-2 pb-1 outline-none", className)}
      {...props}
    />
  );
}

export function CommandEmpty({ className, ...props }: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className={cn("py-8 text-center text-ow-label text-ow-muted", className)} {...props} />;
}

export function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden py-1 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:text-ow-micro **:[[cmdk-group-heading]]:font-bold **:[[cmdk-group-heading]]:tracking-[0.08em] **:[[cmdk-group-heading]]:text-ow-muted **:[[cmdk-group-heading]]:uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex min-h-11 cursor-default items-center gap-3 rounded-[0.875rem] px-3 py-2 text-ow-body outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-ow-recessed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5",
        className,
      )}
      {...props}
    />
  );
}

export function CommandShortcut({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="command-shortcut" className={cn("ml-auto truncate pl-3 text-ow-caption text-ow-muted", className)} {...props} />;
}
