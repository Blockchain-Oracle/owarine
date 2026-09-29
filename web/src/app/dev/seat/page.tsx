import type { Metadata } from "next";
import { SEAT } from "@/features/canton-ux/seat";
import { SeatFixtures } from "./SeatFixtures";

export const metadata: Metadata = { title: `Fixtures · ${SEAT.devTitle}` };

export default function SeatFixturesPage() {
  return <SeatFixtures />;
}
