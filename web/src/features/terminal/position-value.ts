/**
 * What a position counts for in equity, in base units: Close's proceeds for the lots the board can take now, plus the
 * rest at its cost — the live-PnL kernel's own accounting (`livePnl`). Cost is a book value for lots no bid can take
 * (locked, or a thin board), not a price anyone pays.
 */
export function positionValueBase(p: { costBasisBase: bigint }, v: { heldLots: bigint; fillableLots: bigint; exitBase: bigint } | undefined | null): bigint {
  if (!v || v.heldLots === 0n || v.fillableLots === 0n) return p.costBasisBase;
  const rest = v.heldLots - v.fillableLots;
  return v.exitBase + (p.costBasisBase * rest) / v.heldLots;
}
