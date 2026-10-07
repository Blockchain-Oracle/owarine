/**
 * Canton Coin on Noders DevNet (revamp 2b): taps DevNet coin to one of our hosted parties and reads its CIP-56 holdings
 * back, the first step of the rail's DevNet list (docs/evidence/c7b-canton-coin.md "What waits for DevNet", item 4).
 * The scan proxy is the registry base (`CC_REGISTRY_URL`) and takes this ledger user's token (`CC_REGISTRY_AUTH=ledger`).
 *
 *   (devnet.env + local-venue env sourced) CC_REGISTRY_URL=<validator>/api/validator/v0/scan-proxy \
 *     pnpm --filter @owarine/scripts exec tsx drive/cc-devnet.ts --party alice [--tap 100]
 */
import { randomUUID } from "node:crypto";
import { ledgerClientFromEnv, parseLedgerEnv, tokenSourceFromEnv, type Party } from "@owarine/ledger";
import { readCip56Holdings } from "@owarine/markets/holdings";
import { submit } from "@owarine/markets/ops/canton";
import { readTapContext, tapCommand } from "@owarine/markets/ops/cc";
import { readPartiesFile } from "../../services/ops/src/runtime/keys";
import { arg } from "./cli";

const env = parseLedgerEnv(process.env);
const client = ledgerClientFromEnv(env);
const auth = tokenSourceFromEnv(env);
const scanProxyUrl = process.env.CC_REGISTRY_URL;
if (!scanProxyUrl) throw new Error("CC_REGISTRY_URL (the validator's scan proxy) is not set");
const file = readPartiesFile();
const hint = arg("--party", "alice");
const party = (file?.users?.[hint] ?? file?.parties?.[hint as keyof typeof file.parties]) as Party | undefined;
if (!party) throw new Error(`no party "${hint}" in the parties file`);
const tap = arg("--tap", "");

const ctx = await readTapContext({ scanProxyUrl, token: () => auth.token() });
console.log(`DSO ${ctx.dsoParty.slice(0, 24)}… · AmuletRules ${ctx.amuletRules.contractId.slice(0, 16)}… · round ${String((ctx.openRound.payload.round as { number?: string })?.number)}`);

if (tap) {
  const { command, disclosedContracts } = tapCommand(ctx, party, tap);
  const started = Date.now();
  const out = await submit({ role: hint, party, client, dryRun: false }, { commandId: `cc-tap:${hint}:${randomUUID()}`, commands: [command], disclosedContracts });
  console.log(`tapped ${tap} CC to ${hint} in ${Date.now() - started} ms (${out.kind})`);
}

const holdings = await readCip56Holdings(client, party);
const amulet = holdings.filter((h) => h.instrumentAdmin === ctx.dsoParty && h.instrumentId === "Amulet");
const total = amulet.reduce((s, h) => s + h.amountAtomic, 0n);
console.log(`${hint}: ${amulet.length} Amulet holding(s), ${total / 10_000_000_000n}.${(total % 10_000_000_000n).toString().padStart(10, "0")} CC; DSO signed: ${amulet.every((h) => h.signatories.includes(ctx.dsoParty))}; other CIP-56 holdings: ${holdings.length - amulet.length}`);
