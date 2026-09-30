import type { Metadata } from "next";
import { normalizeSeatLinkCode } from "@agari/markets";
import { SEAT, SeatLinkPanel } from "@/features/canton-ux/seat";

export const metadata: Metadata = { title: SEAT.link.title };

/** The seat link between devices (plan, iOS step 2b): show this seat's code, or join another device's. */
export default async function SeatLinkPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const { code } = await searchParams;
  const initial = typeof code === "string" ? normalizeSeatLinkCode(code) : null;
  return (
    // The shell already draws the page's one <main>; a second one here made two landmarks.
    <div className="cx-link-page">
      <SeatLinkPanel initialCode={initial} />
    </div>
  );
}
