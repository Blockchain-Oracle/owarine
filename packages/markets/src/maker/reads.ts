/**
 * Earn's maker vault on Canton (abu-pm-main 0.5.0, K-092, K-200): the `maker` reserve (a `PM.Reserve` statement the
 * ledger computes with `Maker_PublishNav`) and its book, read through `/api/ledger/tickets/*` like the ticket reserves.
 * What the reference's vault carries that the ledger does not, stated rather than invented (D-015):
 *
 *   - the vault's value is its live statement, marked conservatively: a position never counts above its cost, never
 *     above what its Window's Resolution pays, and at 0 once its Window expired unresolved;
 *   - `maker` is the vault's quoting identity (the venue's issuer) while `MAKER_MODE=vault` is on, else null;
 *   - a provider's lifetime supplied/withdrawn counters are not on the ledger: supplied reads as today's worth, as for
 *     the ticket reserves, so no yield is claimed that the ledger cannot show;
 *   - a Window's `openedAtSec` / `settledAtSec` are not on the ledger (0 / null); its flows are the book's receipts.
 */
import type { MakerDeployment, MakerVaultState, MakerWindowView } from "@agari/core/maker";
import type { ProviderShares } from "@agari/core/reserves";
import { sharePriceRawOf } from "@agari/core/reserves";
import { ok, type Reading } from "@agari/core/schemas";
import { seriesIdFromDaml } from "@agari/core/market";
import type { Address, MarketId } from "@agari/core/types";
import { nowMs } from "../provider/clock";
import type { MakerStateWire, MakerWindowWire } from "../provider/ticket-wire";
import { readTicketState, readTicketsMine } from "../tickets/client";
import { TICKET_DECIMALS } from "../tickets/params";
import { cantonNotLive } from "../stub/not-deployed";

/** The reason a maker read states when this deployment has no vault (no ticket desk, or no maker statement). */
export const MAKER_NOT_LIVE = cantonNotLive("maker");

/** The vault's address-shaped id for the reference's `deployment` field: derived and stable, never a chain address. */
const VAULT_ID: Address = seriesIdFromDaml("agari-reserve:maker");
/** The vault's quoting identity while `MAKER_MODE=vault` is on: the venue's issuer, as a derived id. */
const MAKER_ID: Address = seriesIdFromDaml("agari-maker:issuer");

/** Where the vault lives: one per venue, so it is always this derived id. */
export const resolveMakerDeployment = (): MakerDeployment | null => ({ chainId: 0, marketMakerVault: VAULT_ID, fromBlock: 0n });

export function makerWindowOf(w: MakerWindowWire): MakerWindowView {
  return {
    marketId: w.marketId as MarketId, escrowOutBase: w.escrowOutBase, escrowBackBase: w.escrowBackBase, mergedBase: w.mergedBase, payoutBase: w.payoutBase,
    openedAtSec: w.openedAtSec, settledAtSec: w.settledAtSec, quoteCount: w.quoteCount, settled: w.settled, yesRaw: w.yesRaw, noRaw: w.noRaw,
    deployedBase: w.deployedBase, realizedBase: w.realizedBase,
  };
}

export function makerVaultOf(m: MakerStateWire): MakerVaultState {
  return {
    deployment: resolveMakerDeployment()!,
    params: m.params,
    maker: m.quoting ? MAKER_ID : null,
    paused: m.paused,
    liquidBase: m.liquidBase,
    deployedBase: m.deployedBase,
    totalValueBase: m.assetsBase,
    sharePriceRaw: sharePriceRawOf(m.assetsBase, m.shares, TICKET_DECIMALS),
    utilizationBps: m.assetsBase > 0n ? Number((m.deployedBase * 10_000n) / m.assetsBase) : 0,
    supplyShares: m.shares,
    openWindows: m.open.map((w) => w.marketId as MarketId),
    decimals: TICKET_DECIMALS,
  };
}

/** The vault's state as ops read it: null (not an error) where this deployment has no vault. */
export async function readMaker(): Promise<Reading<MakerStateWire | null>> {
  const s = await readTicketState();
  if (!s.ok) return s.error.kind === "not-deployed" ? ok(null, nowMs()) : s;
  return ok(s.value.maker ?? null, s.asOfMs);
}

export async function getMakerVaultState(): Promise<Reading<MakerVaultState | null>> {
  const r = await readMaker();
  return r.ok ? ok(r.value ? makerVaultOf(r.value) : null, r.asOfMs) : r;
}

export async function getMakerWindow(marketId: MarketId): Promise<Reading<MakerWindowView | null>> {
  const r = await readMaker();
  if (!r.ok) return r;
  const w = r.value ? [...r.value.open, ...r.value.history].find((x) => x.marketId === marketId) : undefined;
  return ok(w ? makerWindowOf(w) : null, r.asOfMs);
}

export async function getMakerSharesOf(_wallet: Address): Promise<Reading<ProviderShares>> {
  const mine = await readTicketsMine();
  if (!mine.ok) return mine;
  const s = mine.value.shares.find((x) => x.reserveId === "maker");
  return ok(s ? { shares: s.shares, worthBase: s.worthBase, suppliedBase: s.worthBase, withdrawnBase: 0n } : { shares: 0n, worthBase: 0n, suppliedBase: 0n, withdrawnBase: 0n }, mine.asOfMs);
}
