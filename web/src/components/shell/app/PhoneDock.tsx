"use client";

import { LayoutGrid } from "lucide-react";
import { usePathname } from "next/navigation";
import { FloatingDock, type DockItem } from "@/components/kit";
import { DOCK, placeOf, type NavItem } from "../nav";

/** Trade · Markets · seal · Portfolio · More, on phones only (the rail takes over from md). */
export function PhoneDock({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname();
  const here = placeOf(pathname);
  const docked = [...DOCK.left, ...DOCK.right].some((item) => item.id === here?.id);
  const link = (item: NavItem): DockItem => ({ key: item.id, label: item.short ?? item.name, href: item.href, icon: <item.icon aria-hidden />, active: !moreOpen && here?.id === item.id });
  const more: DockItem = { key: "more", label: "More", icon: <LayoutGrid aria-hidden />, onClick: onMore, expanded: moreOpen, active: moreOpen || (!docked && pathname !== "/") };
  return <FloatingDock className="md:hidden" left={DOCK.left.map(link)} right={[...DOCK.right.map(link), more]} />;
}
