import type { Metadata } from "next";
import { TICKET_CANTON } from "@/features/canton-ux/ticket";
import { TicketCantonFixtures } from "./TicketCantonFixtures";

export const metadata: Metadata = { title: `Fixtures · ${TICKET_CANTON.devTitle}` };

export default function TicketCantonFixturesPage() {
  return <TicketCantonFixtures />;
}
