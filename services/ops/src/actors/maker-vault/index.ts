/**
 * The maker vault (the reference's `agari-maker` behind Earn's maker tab) on Canton, abu-pm-main 0.5.0 (K-092, K-200):
 * a `PM.Reserve` whose cash (`reserve:maker`) quotes pairs as a book inside the venue.
 *
 *   issuer          draws a pair quote or an exit from `reserve:maker` shards when the vault's bounds allow it
 *                   (`MAKER_MODE=vault`), else from the venue desk's       quote:<requestId>, exitquote:<requestId>
 *   reserve         the reserve reporter publishes the statement (`Maker_PublishNav`)        mnav:<seq>
 *   earn            supply · withdraw · merge · settle over `POST /internal/tickets/earn`   earn:*, net:*, settle:*
 *   keeper (here)   expires the vault's unaccepted supply and withdraw quotes, and merges the book's small cash pieces
 *                                                                                            texp:<cid>, mmerge:<digest>
 *
 * Settle and netting of the book's legs are the venue's own actors (the settler settles every leg; netting pairs a
 * book's legs only with the same book's); the ledger pays each back into `reserve:maker`.
 */
import { cmd, digest, failureText, isInactive, submit } from "@agari/markets/ops/canton";
import { tcmd } from "@agari/markets/ops/tickets";
import { runActor, type PassResult } from "../../runtime/actor";
import { submitWithShards } from "../quote-issuer/pooled-submit";
import type { RoleSession } from "@agari/markets/ops/canton";
import { readMakerVaultEnv, type MakerVaultEnv } from "./env";
import { createMakerVault, type MakerVault } from "./vault";

export { createMakerVault, type MakerVault, type MakerStateWireOut } from "./vault";
export { handleMakerEarn, planBookMerges } from "./earn";
export { readMakerVaultEnv, type MakerVaultEnv } from "./env";

/** Seconds past `validUntil` before a quote may be expired (the ledger's `expireSlackSec` plus a margin). */
const EXPIRE_SLACK_SEC = 7;
const MERGE_ABOVE = 6;

export async function keeperPass(v: MakerVault): Promise<PassResult> {
  const snap = await v.refresh();
  const now = Math.floor(Date.now() / 1000);
  let expired = 0;
  let merged = 0;
  const due = (validUntilSec: number) => now > validUntilSec + EXPIRE_SLACK_SEC;
  const expire = async (cid: string, command: ReturnType<typeof tcmd.expireSupplyQuote>) => {
    try {
      const out = await submit(v.venue, { commandId: `texp:${cid}`, commands: [command] });
      if (out.kind === "done") expired++;
    } catch (error) {
      // Accepted, or the ticket keeper expired it first.
      if (!isInactive(error)) v.log(`maker quote expiry failed: ${failureText(error)}`);
    }
  };
  for (const q of snap.supplyQuotes) if (due(q.data.validUntilSec)) await expire(q.cid, tcmd.expireSupplyQuote(q.cid));
  for (const q of snap.withdrawQuotes) if (due(q.data.validUntilSec)) await expire(q.cid, tcmd.expireWithdrawQuote(q.cid));
  if (expired > 0) await v.refresh();
  const free = v.pool.all().filter((s) => s.state === "free");
  if (free.length > MERGE_ABOVE) {
    const leases = v.pool.leaseWhere(() => true, 10, "merge maker");
    const [head, ...rest] = leases;
    if (head && rest.length > 0) {
      try {
        await submitWithShards(v.pool, v.venue, leases, { commandId: `mmerge:${digest(...leases.map((x) => x.cid).sort())}`, commands: [cmd.mergeCash(head.cid, rest.map((x) => x.cid))] });
        merged = leases.length;
      } catch (error) {
        v.log(`maker cash merge failed: ${failureText(error)}`);
      }
    } else v.pool.release(leases);
  }
  const st = v.state();
  return {
    why: st
      ? `maker ${st.assetsBase}/${st.shares} (seq ${st.navSeq}), liquid ${st.liquidBase}, ${st.open.length} Window(s) open${v.env.enabled ? "" : " · not quoting (MAKER_MODE≠vault)"}${expired ? ` · expired ${expired}` : ""}${merged ? ` · merged ${merged} cash` : ""}`
      : "no snapshot yet",
    detail: { expired, merged, open: st?.open.length ?? 0 },
  };
}

/** The vault over the venue's session, and its keeper. Null without a venue session. */
export async function startMakerVault(input: { venue: RoleSession | null; log: (why: string) => void; env?: MakerVaultEnv; everyMs?: number }): Promise<{ vault: MakerVault; stop: () => void } | null> {
  if (!input.venue) {
    input.log("VENUE_PARTY and the parties file are missing: no maker vault");
    return null;
  }
  const env = input.env ?? readMakerVaultEnv();
  const vault = createMakerVault({ venue: input.venue, env, log: input.log });
  const snap = await vault.refresh();
  input.log(
    `maker vault as ${input.venue.party.split("::")[0]}: ${snap.nav ? `statement seq ${snap.nav.data.seq}` : "no statement"}, ${snap.deskCid ? "MakerDesk" : "no MakerDesk"} (bootstrap creates them); ` +
      (env.enabled ? `quoting ${env.assets.join(",") || "every asset"} on ${env.intervals.join(",")} s Windows` : "MAKER_MODE is not vault: the book takes no new quotes"),
  );
  const keeper = runActor({ name: "maker-keeper", log: input.log, dryRun: input.venue.dryRun, everyMs: input.everyMs ?? Number(process.env.MAKER_KEEPER_MS ?? 5_000), pass: () => keeperPass(vault) });
  return { vault, stop: keeper.stop };
}
