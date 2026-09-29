/**
 * The `ReceiptDetail.pick` texts abu-pm-tickets writes (`PM.Tickets.*`): Daml `show` of the side and Int bounds. Pure, so
 * the server half and the client views read them the same way.
 */
/** A range or moonshot pick, `Inside 100..200` (Daml `show` of the side and the two Int bounds). */
export function parseRangePick(pick: string): { side: "inside" | "outside"; lowE8: bigint; highE8: bigint } | null {
  const m = /^(Inside|Outside) (\d+)\.\.(\d+)$/.exec(pick);
  return m ? { side: m[1] === "Inside" ? "inside" : "outside", lowE8: BigInt(m[2]!), highE8: BigInt(m[3]!) } : null;
}

/** A parlay pick, `Up,Down,Up`: one side per leg in the ticket's leg order. */
export function parseParlayPick(pick: string): Array<"up" | "down"> | null {
  const sides = pick.split(",");
  return sides.every((s) => s === "Up" || s === "Down") ? sides.map((s) => (s === "Up" ? "up" : "down")) : null;
}

/** A boost pick, `Up @20000bps`. */
export function parseBoostPick(pick: string): { side: "up" | "down"; leverageBps: number } | null {
  const m = /^(Up|Down) @(\d+)bps$/.exec(pick);
  return m ? { side: m[1] === "Up" ? "up" : "down", leverageBps: Number(m[2]) } : null;
}
