/**
 * The resting desk (C7c, K-235): the venue's side of a pre-open resting call. `startRestingDesk` finds (or, the first time,
 * creates) the venue's `RestingDesk`, serves `POST /internal/resting-offers` (`offer.ts`) and runs the pass that fills calls
 * after the bell, sweeps the expired ones and archives lapsed offers (`filler.ts`, one pass a second).
 *
 *   RestDesk_Offer      restoffer:<requestId>          POST /internal/resting-offers
 *   Rest_Fill           restfill:<callCid>:<lots>
 *   Rest_Expire         restexp:<callCid>
 *   RestOffer_Expire    restoexp:<offerCid>
 *   (create desk)       restdesk:<digest(venue)>       once, when the venue has none
 *
 * `RESTING_FILL=off` keeps the venue from ever taking a call (the reference's post-only maker, `MM_ORDER_TYPE=post-only`):
 * calls still rest and refund, but nothing fills them. Default on: the reference's limit mode, at the call's own price.
 */
import { TEMPLATE_IDS } from "@owarine/daml";
import { cmd, createdOf, pick, readActive, restDeskCommandId, submit } from "@owarine/markets/ops/canton";
import { runActor } from "../../runtime/actor";
import type { LadderBoard } from "../market-maker/seat/ladder-board";
import type { MakerVault } from "../maker-vault/vault";
import type { ShardPool } from "../quote-issuer";
import type { VenueContext } from "../venue/context";
import { restingPass } from "./filler";
import { createOfferHandler } from "./offer";
import { DEFAULT_FILL_CAP_LOTS } from "./rule";
import { createTermsBook } from "./terms";

export interface RestingDeskHandle {
  /** `POST /internal/resting-offers`. */
  handle: (body: unknown) => Promise<{ status: number; body: unknown }>;
  stop: () => void;
}

export async function startRestingDesk(input: {
  venue: VenueContext;
  board: LadderBoard;
  pool: ShardPool | null;
  maker?: MakerVault | null;
  draining?: ReadonlySet<string>;
  log: (why: string) => void;
  env?: NodeJS.ProcessEnv;
}): Promise<RestingDeskHandle | null> {
  const session = input.venue.session("venue");
  if (!session) {
    input.log("VENUE_PARTY and the parties file are missing: no resting calls are offered");
    return null;
  }
  if (!input.pool) {
    input.log("no shard pool (the issuer is off): no resting calls are offered");
    return null;
  }
  const env = input.env ?? process.env;
  const fillEnabled = (env.RESTING_FILL ?? "on").trim().toLowerCase() !== "off";
  const capLots = BigInt(Number(env.MM_MAX_QUOTE_LOTS) > 0 ? Number(env.MM_MAX_QUOTE_LOTS) : Number(DEFAULT_FILL_CAP_LOTS));

  let desk: Promise<string> | null = null;
  const deskCid = () => {
    desk ??= (async () => {
      const [first] = pick(await readActive(session, [TEMPLATE_IDS.RestingDesk]), TEMPLATE_IDS.RestingDesk, (v) => v);
      if (first) return first.cid;
      // The venue's own desk, made once: a venue-only contract that carries no money.
      const out = await submit(session, { commandId: restDeskCommandId(session.party), commands: [cmd.createRestingDesk(session.party)] });
      if (out.kind === "dry") throw new Error("DRY RUN: the venue has no RestingDesk and would create one");
      const created = createdOf(out.created, TEMPLATE_IDS.RestingDesk)[0];
      if (!created) throw new Error("the RestingDesk create landed without a contract");
      input.log("created the venue's RestingDesk");
      return created.contractId;
    })().catch((error: unknown) => {
      desk = null;
      throw error;
    });
    return desk;
  };

  const terms = createTermsBook(session);
  const infrastructure = new Set(Object.values(input.venue.parties));
  const countOpen = async (owner: string, damlMarketId: string): Promise<number> => {
    const acs = await readActive(session, [TEMPLATE_IDS.RestingCall, TEMPLATE_IDS.RestingOffer]);
    let n = 0;
    for (const c of acs) {
      const a = c.createdEvent.createArgument as { owner?: unknown; marketId?: unknown } | null;
      if (a && a.owner === owner && a.marketId === damlMarketId) n++;
    }
    return n;
  };
  const handle = createOfferHandler({
    venue: session, terms: (marketId) => terms.find(marketId), deskCid, board: input.board, infrastructure,
    ...(input.draining ? { draining: input.draining } : {}), countOpen, log: input.log,
  });

  input.log(`resting desk as ${session.party.split("::")[0]}: ${fillEnabled ? "the venue takes a call at its own price when its ladder reaches it" : "FILL OFF: calls rest and refund, nothing fills them"}`);
  const actor = runActor({
    name: "resting-desk",
    log: input.log,
    dryRun: session.dryRun,
    everyMs: 1_000,
    pass: () => restingPass({ venue: session, board: input.board, pool: input.pool!, maker: input.maker ?? null, capLots, fillEnabled, log: input.log }),
  });
  return { handle, stop: actor.stop };
}
