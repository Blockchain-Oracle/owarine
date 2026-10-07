/**
 * The season admin's two acts (K-104, K-105), each an HMAC-signed call to ops' arena desk, never a web route:
 *
 *   withdraw    what the pool holds after its one payout goes back to the venue, and the pool closes
 *               (`Season_WithdrawRemainder`; ops refuses it before the distribution)
 *   distribute  pays the ranked winners once (`Season_Distribute`): `--winners <addr,addr> --amounts <base,base>`
 *
 *   OPS_INTERNAL_URL=http://localhost:8777 OPS_ADMIN_SECRET=… pnpm --filter @owarine/scripts exec tsx season-admin.ts withdraw --season s1
 *
 * Signed with the admin's own `OPS_ADMIN_SECRET` (C4d L4), which ops holds and the web never does.
 */
import type { Address } from "@owarine/core/types";
import { distributeSeasonPrizes, withdrawSeasonRemainder } from "@owarine/markets/games";
import { arg } from "./drive/cli";

const act = process.argv[2];
const rpcUrl = process.env.OPS_INTERNAL_URL ?? "http://localhost:8777";
const seasonId = arg("--season", process.env.SEASON_ID ?? "");
if (!seasonId || (act !== "withdraw" && act !== "distribute")) {
  console.error("usage: season-admin.ts <withdraw|distribute> --season <id> [--winners a,b --amounts 1,2]");
  process.exit(2);
}
try {
  if (act === "withdraw") {
    const r = await withdrawSeasonRemainder({ rpcUrl, seasonId });
    console.log(`season ${seasonId}: withdrew ${r.withdrawnBase} base units to the venue · update ${r.updateId}`);
  } else {
    const winners = arg("--winners", "").split(",").filter(Boolean) as Address[];
    const amountsBase = arg("--amounts", "").split(",").filter(Boolean).map((a) => BigInt(a));
    const updateId = await distributeSeasonPrizes({ secretKey: new Uint8Array(0), rpcUrl, rpcSubscriptionsUrl: "", seasonId, winners, amountsBase });
    console.log(`season ${seasonId}: paid ${winners.length} winner(s) · update ${updateId}`);
  }
} catch (error) {
  console.error(`season ${seasonId}: ${act} refused: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  process.exit(1);
}
