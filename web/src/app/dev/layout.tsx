import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * `/dev/*` are fixture pages for building and capturing the product, not part of it (8 Oct): a production build serves
 * them only when `OWARINE_DEV_ROUTES=1` is set (local captures); the hosted site answers 404.
 */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.OWARINE_DEV_ROUTES !== "1") notFound();
  return children;
}
