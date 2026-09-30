import { StatusDot } from "~/features/desk/kit";
import { SEAT } from "~/wallet/seat-copy";

/**
 * Where web's tap-trading chip sat on the ticket, as a label and not a control (web's `FastChip`): a seat already trades
 * in one tap, with no second key and no caps to set, so there is nothing to arm. The desk kit's quiet state pill, the
 * reference's static chip, in place of a pressed-looking leverage chip that could not be pressed.
 */
export function FastChip() {
  return <StatusDot tone="quiet" label={SEAT.fast.label} />;
}
