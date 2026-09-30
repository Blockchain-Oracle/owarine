"use client";

import { StatusDot } from "@/components/ui/desk-kit";
import { SESSION } from "./copy";

/**
 * Where the reference's tap-trading chip sat on the ticket, as a label and not a control: a seat already trades in one
 * tap, with no second key and no caps to set, so there is nothing to arm. It is the desk kit's quiet state pill (the
 * reference's static "Always open" chip), because the reference's leverage-chip grammar drew a pressed control that
 * could not be pressed, with its reason in a `title` a touch screen never shows.
 */
export function FastChip() {
  return <StatusDot tone="quiet">{SESSION.fast.label}</StatusDot>;
}
