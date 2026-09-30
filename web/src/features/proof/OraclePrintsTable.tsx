import { partyLead } from "@agari/core/units";
import { Hash, TapHash } from "@/components/data";
import { ID_LABEL } from "@/features/canton-ux/id-label";
import type { CantonProofView, OraclePrintView, SlotView } from "./canton-proof";
import { PROOF } from "./copy";
import { afterT, oracleName, priceE8Text } from "./format";

type Tone = "good" | "warn" | "bad" | "off";

function printRow(slot: SlotView, p: OraclePrintView) {
  const tone: Tone = p.counted ? "good" : p.priceE8 !== null ? "warn" : "bad";
  const state = p.counted ? PROOF.counted : p.priceE8 !== null ? PROOF.notCounted : PROOF.missing;
  return (
    <div key={`${slot.slot}:${p.oracle}`} className="status-row">
      <span className="status-dot" data-tone={tone} aria-hidden />
      <span className="status-row-label">{`${PROOF.slot[slot.slot]} · ${oracleName(p.exchange, p.oracle)}`}</span>
      <span className="status-row-lag numbers">{priceE8Text(p.priceE8)}</span>
      <span className="status-row-detail">
        {state}
        {p.fetchedAtSec !== null && ` · ${PROOF.fetched(afterT(p.fetchedAtSec, slot.boundarySec))}`}
        {p.payloadHash && (
          <>
            {" · sha256 "}
            <Hash value={p.payloadHash} lead={8} tail={4} />
          </>
        )}
      </span>
    </div>
  );
}

function medianRow(view: CantonProofView, slot: SlotView) {
  const has = slot.medianE8 !== null && slot.counted >= view.quorum;
  const tone: Tone = !has ? "off" : slot.overLimit ? "bad" : "good";
  return (
    <div key={`median:${slot.slot}`} className="status-row">
      <span className="status-dot" data-tone={tone} aria-hidden />
      <span className="status-row-label">{PROOF.median(PROOF.slot[slot.slot])}</span>
      <span className="status-row-lag numbers">{has ? priceE8Text(slot.medianE8) : "—"}</span>
      <span className="status-row-detail">
        {has ? PROOF.medianDetail(slot.counted, view.quorum, slot.spreadBps ?? "0", view.maxDeviationBps, slot.overLimit) : PROOF.noMedian(slot.counted, view.quorum)}
      </span>
    </div>
  );
}

/** Where the close median finished against the open print (a tie goes to the Window's tie rule). */
function closeWord(openE8: string | null, closeE8: string | null): string {
  if (openE8 === null || closeE8 === null) return "against";
  const [o, c] = [BigInt(openE8), BigInt(closeE8)];
  return c > o ? "above" : c < o ? "under" : "level with";
}

function resultRow(view: CantonProofView) {
  const r = view.result;
  const tone: Tone = r.kind === "resolved" ? "good" : r.kind === "voided" ? "warn" : "off";
  const text =
    r.kind === "resolved"
      ? PROOF.resolved(r.side.toUpperCase(), closeWord(view.open.ledgerE8, view.close.ledgerE8))
      : r.kind === "voided"
        ? PROOF.voided(r.reason ? `${PROOF.voidReason[r.reason.kind]} (${PROOF.voidSlot[r.reason.slot]})` : PROOF.voidReason.MissingPrint)
        : PROOF.pending;
  return (
    <div className="status-row">
      <span className="status-dot" data-tone={tone} aria-hidden />
      <span className="status-row-label">{PROOF.result}</span>
      <span className="status-row-lag">{r.kind === "resolved" ? r.side.toUpperCase() : r.kind === "voided" ? "VOID" : "—"}</span>
      <span className="status-row-detail">{text}</span>
    </div>
  );
}

/**
 * The Window's prints at a glance, in the status table's rows (Masayume `/status`): every oracle's quote at the open and
 * the close (counted, posted late, or missing), each slot's median and spread against the limit, the result, and the
 * two parties whose signatures the Resolution carries.
 */
export function OraclePrintsTable({ view }: { view: CantonProofView }) {
  const slots = [view.open, view.close];
  const n = slots.reduce((sum, s) => sum + s.prints.filter((p) => p.priceE8 !== null).length, 0);
  return (
    <div className="status-table">
      <div className="status-table-head">
        <h3 className="status-table-title">{PROOF.tableTitle(n)}</h3>
      </div>
      <div className="status-table-body">
        {slots.flatMap((slot) => [...slot.prints.map((p) => printRow(slot, p)), medianRow(view, slot)])}
        {resultRow(view)}
        {view.signatories && (
          <div className="status-row">
            <span className="status-dot" data-tone="good" aria-hidden />
            <span className="status-row-label">{PROOF.signedBy}</span>
            <span className="status-row-lag">2</span>
            <span className="status-row-detail">
              <TapHash value={view.signatories.resolver} lead={partyLead(view.signatories.resolver)} tail={4} label={ID_LABEL.party} />
              {view.signatories.venue && (
                <>
                  {" + "}
                  <TapHash value={view.signatories.venue} lead={partyLead(view.signatories.venue)} tail={4} label={ID_LABEL.party} />
                </>
              )}
              {` · ${PROOF.signatories}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
