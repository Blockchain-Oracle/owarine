import type { Metadata } from "next";
import { NotFoundScreen } from "@/features/not-found/NotFoundScreen";

export const metadata: Metadata = { title: "Not found" };

/** An unknown path answers 404 with its own page (Abu, 8 Oct); retired routes still redirect, from next.config. */
export default function NotFound() {
  return <NotFoundScreen />;
}
