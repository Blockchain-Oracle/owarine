/**
 * C2d: the maker vault on a LOCAL sandbox (called by `bootstrap-local.ts`; `--no-maker` skips it). abu-pm-main 0.5.0
 * (K-092, K-200). Idempotent: a desk, statement or LP holding that already exists is left as it is.
 *
 *   1. creates the venue's `MakerDesk` and the `maker` reserve's `NavStatement` (auditor-visible),
 *   2. seeds the vault from the LP party (`--maker-seed` credits, default 10,000, in four supplies at the first
 *      statement's 1:1 price): its cash lands in `reserve:maker`, four shards the issuer can lock quotes from,
 *   3. publishes the first statement on ledger (`Maker_PublishNav`); from then on the reserve reporter publishes.
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import type { Command, CreatedEvent, LedgerClient } from "@owarine/ledger";
import { bcmd, MAKER_BOOK, MAKER_RESERVE } from "@owarine/markets/ops/book";
import { cmd, decodeVenueCash, pick, readActive, type RoleSession } from "@owarine/markets/ops/canton";
import { decodeLpShare, decodeNavStatement, tcmd } from "@owarine/markets/ops/tickets";
import { arg } from "./drive/cli";

const CREDIT = 1_000_000n;

export async function bootstrapMaker(o: {
  client: LedgerClient;
  venue: RoleSession;
  auditor: string;
  lp: string;
  run: string;
  log: (s: string) => void;
  /** How writes go out (C2y: the DevNet bootstrap's recording, dry-run-aware writer). Default: submit and wait. */
  write?: (role: string, party: string, commandId: string, commands: Command[]) => Promise<CreatedEvent[]>;
}): Promise<void> {
  const { client, venue, auditor, lp, run, log } = o;
  const v = venue.party;
  const seed = BigInt(arg("--maker-seed", "10000")) * CREDIT;
  const nowSec = () => Math.floor(Date.now() / 1000);
  const submitAs = async (party: string, commandId: string, commands: Command[]): Promise<CreatedEvent[]> => {
    if (o.write) return o.write(party === lp ? "lp" : "venue", party, commandId, commands);
    const r = await client.submitAndWaitForTransaction({ actAs: [party], commandId, commands });
    return r.transaction.events.flatMap((e) => ("CreatedEvent" in e ? [e.CreatedEvent] : []));
  };
  const read = () => readActive(venue, [TEMPLATE_IDS.MakerDesk, TEMPLATE_IDS.NavStatement, TEMPLATE_IDS.LpShare, TEMPLATE_IDS.VenueCash]);
  let acs = await read();
  if (!acs.some((c) => c.createdEvent.templateId.endsWith(":PM.Maker:MakerDesk"))) {
    await submitAs(v, `bootstrap:makerdesk:${run}`, [bcmd.createMakerDesk(v)]);
    log(`${venue.dryRun ? "would create" : "created"} the MakerDesk`);
  }
  if (!pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement).some((n) => n.data.reserveId === MAKER_RESERVE)) {
    await submitAs(v, `bootstrap:reserve:${MAKER_RESERVE}:${run}`, [tcmd.createNavStatement({ venue: v, auditor, reserveId: MAKER_RESERVE, asOfSec: nowSec() })]);
    log(`${venue.dryRun ? "would create" : "created"} the maker vault's statement`);
  }

  // A dry run prepares only the writes above: the LP seed and the first statement need contracts those writes create.
  if (venue.dryRun) {
    log("dry run: the maker vault's LP seed and first statement wait for the real run");
    return;
  }

  // The LP's venue account (the ticket bootstrap opens it; this opens it when tickets were skipped).
  const lpAcs = await client.activeContracts({ parties: [lp], templateIds: [TEMPLATE_IDS.VenueAccount] });
  let accountCid = lpAcs.contracts.find((c) => (c.createdEvent.createArgument as { owner?: string }).owner === lp)?.createdEvent.contractId;
  if (!accountCid) {
    const invite = (await submitAs(v, `bootstrap:lp-invite:maker:${run}`, [cmd.inviteAccount(v, lp, "lp")]))[0]!.contractId;
    accountCid = (await submitAs(lp, `bootstrap:lp-accept:maker:${run}`, [cmd.acceptInvite(invite)]))[0]!.contractId;
    log("opened the LP's venue account");
  }

  acs = await read();
  if (!pick(acs, TEMPLATE_IDS.LpShare, decodeLpShare).some((s) => s.data.reserveId === MAKER_RESERVE && s.data.provider === lp)) {
    const nav = pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement).find((n) => n.data.reserveId === MAKER_RESERVE)!;
    const piece = seed / 4n;
    for (let i = 0; i < 4; i++) {
      const cash = (await submitAs(v, `bootstrap:lp-credit:maker:${i}:${run}`, [cmd.creditAccount(accountCid, piece, "lp-seed")])).find((e) => e.templateId.endsWith(":PM.Money:VenueCash"))!.contractId;
      const quote = (await submitAs(v, `bootstrap:supply:maker:${i}:${run}`, [tcmd.issueSupply(nav.cid, { provider: lp, cashIn: piece, validUntilSec: nowSec() + 120 })])).find((e) =>
        e.templateId.endsWith(":PM.Reserve:SupplyQuote"),
      )!.contractId;
      await submitAs(lp, `bootstrap:supply-accept:maker:${i}:${run}`, [tcmd.acceptSupply(quote, [cash])]);
    }
    log(`seeded the maker vault with ${seed / CREDIT} credits from the LP (four reserve:maker shards)`);
  }

  // The first statement, counted on ledger: the book holds only its cash yet.
  acs = await read();
  const nav = pick(acs, TEMPLATE_IDS.NavStatement, decodeNavStatement).find((n) => n.data.reserveId === MAKER_RESERVE)!;
  if (nav.data.seq > 0) return;
  const desk = acs.find((c) => c.createdEvent.templateId.endsWith(":PM.Maker:MakerDesk"))!.createdEvent.contractId;
  const cash = pick(acs, TEMPLATE_IDS.VenueCash, decodeVenueCash).filter((c) => c.data.owner === v && c.data.bucket === MAKER_BOOK);
  const lpShares = pick(acs, TEMPLATE_IDS.LpShare, decodeLpShare).filter((s) => s.data.reserveId === MAKER_RESERVE);
  const inputs = { cash: cash.map((c) => c.cid), lpShares: lpShares.map((s) => s.cid), withdrawQuotes: [], quotes: [], buyQuotes: [], legs: [], residuals: [], resolutions: [] };
  await submitAs(v, `bootstrap:nav:${MAKER_RESERVE}:${run}`, [bcmd.publishMakerNav(desk, nav.cid, nowSec(), inputs)]);
  log(`published the maker vault's statement: ${cash.reduce((a, c) => a + c.data.amount, 0n) / CREDIT} credits, ${lpShares.length} share contract(s)`);
}
