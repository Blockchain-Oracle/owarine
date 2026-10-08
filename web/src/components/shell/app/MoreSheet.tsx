"use client";

import Link from "next/link";
import { Sheet } from "@/components/kit";
import { MORE } from "../nav";

/** Every place in Owarine, grouped as the old drawer grouped them, in the kit's bottom sheet. */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Everything">
      <div className="flex flex-col gap-5">
        {MORE.map((section) => (
          <section key={section.id} className="flex flex-col gap-1.5">
            <p className="px-1 text-ow-micro font-bold tracking-[0.1em] text-ow-muted">{section.name.toUpperCase()}</p>
            <div className="overflow-hidden rounded-ow-card bg-ow-recessed/60">
              {section.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  {...(item.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="flex items-center gap-3 border-b border-ow-hairline px-4 py-3 last:border-b-0 hover:bg-ow-recessed"
                >
                  <item.icon className="size-4.5 text-ow-muted" />
                  <span className="flex-1">
                    <span className="block text-ow-body">{item.name}</span>
                    <span className="block text-ow-caption text-ow-muted">{item.description}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
