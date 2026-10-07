import { CLUSTER_LABEL } from "@owarine/core/constants";
import { ensureMarkets, getClient, NOT_DEPLOYED_TECHNICAL } from "@owarine/markets";
import { webEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Boot check — the markets runtime as this deployment configured it. Masayume probed the DreamDEX indexer and its live
 * markets here; on Canton the Daml package reaches the participant in C2 and the adapter in C4, so the honest probe is
 * the configuration itself and the stub's own answer until they do (D-015).
 */
export default async function BootPage() {
  ensureMarkets(webEnv.markets);
  const client = getClient();
  const { markets: env } = webEnv;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8 font-mono text-sm">
      <h1 className="text-xl font-semibold">Boot check — {CLUSTER_LABEL[env.cluster]}</h1>
      <section>
        <h2 className="font-semibold">Config (zero-env defaults unless overridden)</h2>
        <ul>
          <li>
            cluster: {CLUSTER_LABEL[client.cluster]} ({env.chainId})
          </li>
          <li>ledger routes: {client.ledgerApiPath}</li>
          <li>indexer: {env.indexerUrl ?? "—"}</li>
          <li>venue: {env.venueId ?? "—"}</li>
          <li>price feed: {client.priceFeedUrl ?? "—"}</li>
          <li>ladder: {client.ladderUrl ?? "—"}</li>
          <li>daml package: {client.packageName}</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Engine</h2>
        <p>{NOT_DEPLOYED_TECHNICAL}</p>
      </section>
    </main>
  );
}
