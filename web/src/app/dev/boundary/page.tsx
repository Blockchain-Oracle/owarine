import type { Metadata } from "next";
import { SectionHeader } from "@/components/chrome";
import { BoundaryProbe } from "./BoundaryProbe";

export const metadata: Metadata = { title: "Fixtures · error boundary" };
export const dynamic = "force-dynamic";

/**
 * L-07 (C5d): the route boundary (`app/error.tsx` → `BoundaryScreen`) catching a real error in a production build.
 * `?throw=server` throws while the server renders this page (the boundary shows the digest only); the button throws
 * while the browser renders (the boundary shows the message). Nothing else on the site can be made to throw on demand.
 */
export default async function DevBoundaryPage({ searchParams }: { searchParams: Promise<{ throw?: string }> }) {
  if ((await searchParams).throw === "server") throw new Error("C5d boundary probe: thrown on purpose while the server rendered /dev/boundary");
  return (
    <div className="mx-auto flex w-full max-w-(--content-reading) flex-col gap-6 px-gutter py-8">
      <SectionHeader index="00" title="Error boundary" />
      <p className="type-body text-ink-secondary">
        Throws a real error so the route boundary can be seen catching it: from the browser&apos;s render below, or from the server&apos;s with{" "}
        <code>?throw=server</code>. &ldquo;Try again&rdquo; renders the page afresh.
      </p>
      <BoundaryProbe />
    </div>
  );
}
