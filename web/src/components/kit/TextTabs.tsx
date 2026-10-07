"use client";

import { Tabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * UGLYCASH's top navigation: words, not chips. The active word is ink with a short black bar under it, the rest are
 * muted; they scroll sideways on a phone. Base UI's Tabs.Indicator slides the bar (`--active-tab-left/width`).
 */
export interface TextTab<T extends string> {
  value: T;
  label: ReactNode;
}

export interface TextTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  tabs: readonly TextTab<T>[];
  /** Accessible name for the tab list. */
  label: string;
  size?: "md" | "lg";
  children?: ReactNode;
  className?: string;
}

export function TextTabs<T extends string>({ value, onChange, tabs, label, size = "md", children, className }: TextTabsProps<T>) {
  return (
    <Tabs.Root value={value} onValueChange={(v) => onChange(v as T)} className={cn("min-w-0", className)}>
      <Tabs.List aria-label={label} className="relative flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <Tabs.Tab
            key={t.value}
            value={t.value}
            className={cn(
              "ow-body shrink-0 cursor-pointer font-bold whitespace-nowrap text-ow-helper outline-none transition-colors duration-150 hover:text-ow-muted data-active:text-ow-ink focus-visible:text-ow-ink",
              size === "lg" ? "text-ow-title" : "text-ow-lead",
            )}
          >
            {t.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="absolute bottom-0 left-0 h-0.75 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-ow-ink transition-[translate,width] duration-200 ease-ow-spring" />
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}

export const TextTabPanel = Tabs.Panel;
