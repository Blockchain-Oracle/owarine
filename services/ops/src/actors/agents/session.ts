/**
 * An agent's session on Canton (C8f): what the strategy runner and the X relay act through. The agent is a party (the
 * house agent-runner, or a self-hosting creator's own seat party, L-55); it holds no key and no cash, and it places a
 * call for an owner only by exercising `Grant_AcceptQuote` on the grant that owner opened to it (`GrantExecutor`).
 *
 * The session keeps the shape the ported actors already call (`address`, `contracts`, `submitter.submitOrder` with
 * `route: vault-grant`), and installs this process's ledger readers behind `@agari/markets`' vault and strategy reads:
 *
 *   getVaultSnapshot(owner)      the owner's grants naming this agent, by kind (an owner is a party, or a seat address
 *                                resolved through the lease table)
 *   getVaultHoldings(owner, w)   the owner's legs on that Window, read as the venue ("already in this Window")
 *   getVaultGrant(id)            one grant naming this agent
 *   recoverVaultExecution(e)     the ledger's completion for the attempt's deterministic command id
 *   listStrategies, listLiveSubscribers, listStrategySubscribers
 *                                the registry as the venue reads it (or, self-hosted, as the agent: its own strategies
 *                                and the consents naming it, K-089)
 */
import type { IntentJournal, OrderOutcome, OrderRequest, TxIntent, TxOutcome } from "@agari/core/ports";
import { err, ok, type Reading } from "@agari/core/schemas";
import type { StrategyRecord, StrategySubscription } from "@agari/core/strategies";
import { diagnosis, type Address, type OnchainSnapshot } from "@agari/core/types";
import type { VaultDeployment, VaultGrant, VaultSnapshot } from "@agari/core/vault";
import { getDb } from "@agari/db";
import { TEMPLATE_IDS } from "@agari/daml";
import type { LedgerClient, Party } from "@agari/ledger";
import { cantonVaultDeployment, installVaultExecutionResolver, installVaultReader } from "@agari/markets/vault";
import { installStrategyReader } from "@agari/markets/strategies";
import { createGrantExecutor, grantFor, grantIdOfC, grantsByKind, grantView, strategyView, subscriptionView, type AgentGrantC, type QuoteSource } from "@agari/markets/ops/agents";
import { decodeLeg } from "@agari/markets/ops/canton";
import { appMarketId, readRegistry } from "@agari/markets/server";
import { CLUSTER_ID, type Cluster } from "@agari/core/constants";

const PARTY_ID = /^[A-Za-z0-9_\-:.]{1,255}::[0-9a-f]{8,}$/;
const REGISTRY_CACHE_MS = 5_000;

export interface AgentSession {
  readonly authority: "strategy-runner" | "x-executor";
  /** The agent's party: what every grant it acts through names. */
  readonly address: Address;
  readonly contracts: { signer: Address; deployment: VaultDeployment | null };
  readonly submitter: {
    submitOrder(request: OrderRequest & { fromOffset?: bigint }): Promise<OrderOutcome>;
    /** An agent writes nothing but grant-scoped orders: the venue settles legs itself, so a crank is refused. */
    submitTx(intent: TxIntent): Promise<TxOutcome>;
  };
  /** The ledger end now: what an attempt records before its send, and what its command id is derived from. */
  recoveryCursor(): Promise<Reading<{ fromSlot: bigint }>>;
  /** The owner's party behind an owner label (a party, or a leased seat's address). */
  ownerParty(owner: string): Promise<Party | null>;
}

export interface AgentSessionConfig {
  client: LedgerClient;
  agent: Party;
  /** The venue party when this process may read as it (ops); null for a self-hosted runner. */
  venue: Party | null;
  quotes: QuoteSource;
  authority: AgentSession["authority"];
  cluster?: Cluster;
  /** Where each grant order is recorded before its send (the X relay writes it onto the claimed mention). */
  journal?: IntentJournal;
  now?: () => number;
}

/** A leased seat's party by its address (the X link binds an address), read from the web's seat pool. */
async function partyOfAddress(address: string): Promise<Party | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db<{ party: string }[]>`SELECT party FROM seat_pool WHERE state = 'leased' AND address = ${address} LIMIT 1`;
    return rows[0]?.party ?? null;
  } catch {
    return null;
  }
}

export function createAgentSession(cfg: AgentSessionConfig): AgentSession {
  const { client, agent } = cfg;
  const now = cfg.now ?? Date.now;
  const nowSec = () => Math.floor(now() / 1000);
  const executor = createGrantExecutor({
    client,
    agent,
    readAs: (owner) => (cfg.venue ? [cfg.venue] : [owner]),
    quotes: cfg.quotes,
    role: cfg.authority === "x-executor" ? "x" : "strategy",
    now,
  });
  const deployment = cantonVaultDeployment(CLUSTER_ID[cfg.cluster ?? "localnet"]);
  const reader = cfg.venue ?? agent;

  const ownerParty = async (owner: string): Promise<Party | null> => (PARTY_ID.test(owner) ? owner : partyOfAddress(owner));
  const grantsOf = async (owner: Party): Promise<{ cid: string; data: AgentGrantC }[]> => (await executor.grantsNamingMe()).filter((g) => g.data.owner === owner);

  // ---- the vault reads, for this agent's grants ----
  installVaultReader({
    async snapshot(owner: Address): Promise<Reading<VaultSnapshot | null>> {
      try {
        const party = await ownerParty(owner);
        if (!party) return ok({ deployment, account: { availableBase: 0n, privateAvailableBase: 0n, totalDepositedBase: 0n, totalWithdrawnBase: 0n }, grants: { session: null, executor: null, strategy: null }, decimals: 6 }, now());
        const t = nowSec();
        const grants = (await grantsOf(party)).map((g) => grantView(g.data, t, owner));
        return ok({ deployment, account: { availableBase: 0n, privateAvailableBase: 0n, totalDepositedBase: 0n, totalWithdrawnBase: 0n }, grants: grantsByKind(grants), decimals: 6 }, now());
      } catch (error) {
        return err(diagnosis("rpc-down", `grants unreadable: ${error instanceof Error ? error.message : String(error)}`));
      }
    },
    async grant(grantId: bigint): Promise<VaultGrant> {
      const hit = (await executor.grantsNamingMe()).find((g) => grantIdOfC(g.data) === grantId);
      if (!hit) throw new Error(`grant #${grantId} names another agent or is no longer on the ledger`);
      return grantView(hit.data, nowSec());
    },
    async holdings(owner: Address, onchain: OnchainSnapshot) {
      try {
        const party = await ownerParty(owner);
        if (!party) return err(diagnosis("indexer-down", "the owner's seat could not be resolved"));
        const r = await client.activeContracts({ parties: [reader], templateIds: [TEMPLATE_IDS.Leg] });
        let upRaw = 0n;
        let downRaw = 0n;
        for (const c of r.contracts) {
          try {
            const l = decodeLeg(c.createdEvent.createArgument);
            if (l.owner !== party || appMarketId(l.marketId) !== onchain.marketId) continue;
            const contracts = l.lots * 1000n * l.cashUnit;
            if (l.outcome === "SideUp") upRaw += contracts;
            else downRaw += contracts;
          } catch {
            // skip
          }
        }
        return ok({ marketId: onchain.marketId, upRaw, downRaw, upGrantId: 0n, downGrantId: 0n }, now());
      } catch (error) {
        return err(diagnosis("rpc-down", `legs unreadable: ${error instanceof Error ? error.message : String(error)}`));
      }
    },
  });
  installVaultExecutionResolver((e) => executor.recover(e));

  // ---- the registry, as the venue (or, self-hosted, as the agent) reads it ----
  let registry: { atMs: number; value: ReturnType<typeof readRegistry> } | null = null;
  const reg = () => {
    if (registry && now() - registry.atMs < REGISTRY_CACHE_MS) return registry.value;
    const value = readRegistry(client, reader, now());
    const entry = { atMs: now(), value };
    registry = entry;
    value.catch(() => registry === entry && (registry = null));
    return value;
  };
  const liveSubscribers = async (strategyId: bigint): Promise<StrategySubscription[]> => {
    const r = await reg();
    const e = r.byNum.get(strategyId.toString());
    if (!e) return [];
    const grants = (await executor.grantsNamingMe()).map((g) => g.data);
    const t = nowSec();
    return r.subscriptions
      .filter((s) => s.data.strategyId === e.listing.data.strategyId && s.data.runner === agent)
      .map((s) => subscriptionView(s.data, grantFor(grants, s.data.subscriber, s.data.runner, t), t, s.createdAtSec));
  };
  installStrategyReader({
    async listStrategies(): Promise<Reading<StrategyRecord[] | null>> {
      try {
        const r = await reg();
        return ok(r.entries.map((e) => strategyView(e.listing.data, e.strategy?.data ?? null, e.subscribers)), now());
      } catch (error) {
        return err(diagnosis("rpc-down", `registry unreadable: ${error instanceof Error ? error.message : String(error)}`));
      }
    },
    async listLiveSubscribers(strategyId: bigint): Promise<Reading<StrategySubscription[]>> {
      try {
        return ok((await liveSubscribers(strategyId)).filter((s) => s.live), now());
      } catch (error) {
        return err(diagnosis("rpc-down", `consents unreadable: ${error instanceof Error ? error.message : String(error)}`));
      }
    },
    async listStrategySubscribers(strategyId: bigint): Promise<Address[]> {
      return (await liveSubscribers(strategyId)).map((s) => s.subscriber);
    },
  });

  let lastCursor: bigint | null = null;
  return {
    authority: cfg.authority,
    address: agent as Address,
    contracts: { signer: agent as Address, deployment },
    ownerParty,
    async recoveryCursor() {
      try {
        lastCursor = BigInt(await client.ledgerEnd());
        return ok({ fromSlot: lastCursor }, now());
      } catch (error) {
        return err(diagnosis("rpc-down", `the ledger end could not be read: ${error instanceof Error ? error.message : String(error)}`));
      }
    },
    submitter: {
      async submitTx(intent: TxIntent): Promise<TxOutcome> {
        return { status: "refused", diagnosis: diagnosis("grant-refused", `${intent.kind}: the venue's settler settles every leg into its owner's cash at resolution; an agent sends nothing but grant-scoped orders`) };
      },
      async submitOrder(request): Promise<OrderOutcome> {
        if (request.route?.kind !== "vault-grant") return { status: "refused", diagnosis: diagnosis("grant-refused", "an agent places only through an owner's grant") };
        const grantId = request.route.grantId;
        const grant = (await executor.grantsNamingMe()).find((g) => grantIdOfC(g.data) === grantId);
        if (!grant) return { status: "refused", diagnosis: diagnosis("grant-refused", `grant #${grantId} is not live for this agent`) };
        const fromOffset = request.fromOffset ?? lastCursor ?? BigInt(await client.ledgerEnd());
        const record = cfg.journal ? await cfg.journal.record({ kind: "order", wallet: agent as Address, summary: `${request.side} ${request.stakeBase} for ${grant.data.owner.split("::")[0]} through grant #${grantId}`, marketId: request.market.marketId }) : null;
        const outcome = await executor.place({ owner: grant.data.owner, grant, market: request.market, side: request.side, stakeBase: request.stakeBase, displayedQuote: request.displayedQuote, fromOffset: Number(fromOffset) });
        if (record && cfg.journal) {
          if (outcome.status === "confirmed") {
            await cfg.journal.markSent(record.id, outcome.booked.txHash);
            await cfg.journal.markConfirmed(record.id);
          } else if (outcome.status === "unknown") await cfg.journal.markUnknown(record.id);
          else await cfg.journal.markFailed(record.id, outcome.status === "refused" ? outcome.diagnosis.technical : outcome.status);
        }
        return outcome;
      },
    },
  };
}

