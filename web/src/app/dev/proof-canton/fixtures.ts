import type { ResolutionEvidence } from "@/features/canton-ux/proof";
import { ORACLES, updateId } from "../canton-ids";

/**
 * `/dev/proof-canton`: a TSLA 5m Window decided two ways. Resolved: three oracle quotes, a median, a spread well under
 * the limit. Voided: the third oracle never reported, so there was no quorum. Prices, times and ids are fixture values.
 */
const OPEN_MS = Date.UTC(2026, 8, 29, 14, 35, 0);
const CLOSE_MS = OPEN_MS + 5 * 60_000;
const DEADLINE_MS = CLOSE_MS + 30_000;
export const FIXTURE_MARKET = "7e57".repeat(11);

export const RESOLVED: ResolutionEvidence = {
  open: { priceText: "359.42", atMs: OPEN_MS, updateId: updateId("0be4") },
  quotes: [
    { party: ORACLES[0], priceText: "358.98", atMs: CLOSE_MS + 2_140, updateId: updateId("a11a") },
    { party: ORACLES[1], priceText: "358.97", atMs: CLOSE_MS + 2_610, updateId: updateId("b22b") },
    { party: ORACLES[2], priceText: "359.03", atMs: CLOSE_MS + 3_050, updateId: updateId("c33c") },
  ],
  deadlineMs: DEADLINE_MS,
  median: { priceText: "358.98", spreadText: "0.017%", limitText: "0.50%" },
  outcome: { kind: "resolved", side: "DOWN", word: "under", closeText: "358.98", atMs: CLOSE_MS + 4_200, updateId: updateId("d44d") },
};

export const VOIDED: ResolutionEvidence = {
  ...RESOLVED,
  quotes: [RESOLVED.quotes[0]!, RESOLVED.quotes[1]!, { party: ORACLES[2], priceText: null, atMs: null, updateId: null }],
  median: null,
  outcome: { kind: "voided", reason: "quorum", atMs: DEADLINE_MS + 1_800, updateId: updateId("e55e") },
};
