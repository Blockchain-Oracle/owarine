import { Hash } from "@/components/data";
import { Receipt, ReceiptRow } from "@/components/receipt";
import type { CantonProofView } from "./canton-proof";
import { PROOF } from "./copy";
import { partyLead, priceE8Text } from "./format";

const R = PROOF.receipt;

/** The Window's result as one cream receipt (the verdict receipt's anatomy): the close median, the open, the spread against the limit, who signed. */
export function ResolutionReceipt({ view }: { view: CantonProofView }) {
  const r = view.result;
  if (r.kind === "pending") return null;
  const voided = r.kind === "voided";
  return (
    <Receipt
      title={R.title}
      figure={<span className="numbers">{voided ? R.figureVoid : priceE8Text(view.close.ledgerE8)}</span>}
      figureLabel={voided ? PROOF.voided(r.reason ? PROOF.voidReason[r.reason.kind] : PROOF.voidReason.MissingPrint) : R.figureClose}
      settledAtMs={r.atMs}
      footer={R.footer}
    >
      <ReceiptRow label={R.rows.open}>{priceE8Text(view.open.ledgerE8)}</ReceiptRow>
      {!voided && <ReceiptRow label={R.rows.close}>{priceE8Text(view.close.ledgerE8)}</ReceiptRow>}
      {view.close.spreadBps !== null && <ReceiptRow label={R.rows.spread}>{R.spread(view.close.spreadBps, view.maxDeviationBps)}</ReceiptRow>}
      <ReceiptRow label={R.rows.quorum}>{R.quorum(view.close.counted || view.open.counted, view.close.prints.length, view.quorum)}</ReceiptRow>
      <ReceiptRow label={R.rows.outcome}>{r.kind === "resolved" ? r.side.toUpperCase() : "VOID"}</ReceiptRow>
      {view.signatories && (
        <ReceiptRow label={R.rows.resolver}>
          <Hash value={view.signatories.resolver} lead={partyLead(view.signatories.resolver)} tail={4} />
        </ReceiptRow>
      )}
      {view.signatories?.venue && (
        <ReceiptRow label={R.rows.venue}>
          <Hash value={view.signatories.venue} lead={partyLead(view.signatories.venue)} tail={4} />
        </ReceiptRow>
      )}
      {r.updateId && (
        <ReceiptRow label={R.rows.update} href={`/proof?update=${encodeURIComponent(r.updateId)}`}>
          <Hash value={r.updateId} lead={10} tail={4} />
        </ReceiptRow>
      )}
    </Receipt>
  );
}
