import { SEAT_READ_HEADER, SEAT_WRITE_HEADER } from "@owarine/core/auth";
import { seatReadHeaderValue, seatWriteHeaderValue } from "@owarine/markets";

/**
 * The seat's proof on a plain `fetch` of our own address-keyed routes (C4d M3): the web's seat cookie rides along by
 * itself; the phone has none, so a read carries the signed read header and a write its one-request write proof
 * (`@owarine/markets` `ledger-api.ts`). Without a registered seat key these add nothing and the cookie alone speaks.
 */
export async function seatReadHeaders(): Promise<Record<string, string>> {
  const value = await seatReadHeaderValue().catch(() => null);
  return value ? { [SEAT_READ_HEADER]: value } : {};
}

export async function seatWriteHeaders(method: string, url: string, body: string): Promise<Record<string, string>> {
  const value = await seatWriteHeaderValue(method, url, body).catch(() => null);
  return value ? { [SEAT_WRITE_HEADER]: value } : {};
}
