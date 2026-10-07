import { formatUtc } from "@owarine/core/units";
import Link from "next/link";
import { TapHash } from "@/components/data/TapHash";
import { ID_LABEL } from "@/features/canton-ux/id-label";
import { PROOF_CANTON } from "@/features/canton-ux/proof/copy";
import "@/features/canton-ux/proof/proof-canton.css";
import type { LedgerUpdateFacts } from "./resolution-evidence.server";

const U = PROOF_CANTON.updatePlate;

/**
 * `/proof?update=<id>`, where a receipt's "Ledger update" link lands: the update as the venue's projection holds it,
 * and the way on to how its Window was decided. An update the projection has not caught up with says so.
 */
export function LedgerUpdatePlate({ updateId, facts }: { updateId: string; facts: LedgerUpdateFacts | "missing" }) {
  return (
    <section className="status-holding proof-update" aria-label={U.title} role="status">
      <p className="status-holding-text">
        {U.title} <TapHash value={updateId} lead={10} tail={6} label={ID_LABEL.update} />
      </p>
      {facts === "missing" ? (
        <p className="type-caption text-ink-secondary">{U.missing}</p>
      ) : (
        <>
          <p className="type-caption text-ink-secondary">{U.facts(facts.offset, formatUtc(facts.atMs), facts.events)}</p>
          {facts.market && (
            <Link href={`/proof/${facts.market}`} className="type-caption text-accent underline underline-offset-4">
              {U.window}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
