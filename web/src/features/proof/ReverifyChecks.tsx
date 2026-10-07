import type { ProofCheck, ReverifyReport } from "@owarine/core/proof";
import { PROOF } from "./copy";
import { oracleName, priceE8Text } from "./format";

const isPrice = (c: ProofCheck) => c.kind === "median" || c.kind === "archive" || c.kind === "exchange";

function label(c: ProofCheck): string {
  const who = c.oracle ? ` · ${oracleName(c.exchange, c.oracle)}` : "";
  const slot = c.slot ? `${PROOF.slot[c.slot]} · ` : "";
  return `${slot}${PROOF.check[c.kind]}${who}`;
}

function detail(c: ProofCheck): string {
  const show = (v: string | null) => (v === null ? "—" : isPrice(c) ? priceE8Text(v) : c.kind === "hash" ? `${v.slice(0, 10)}…` : v);
  // The status already stands in its own column; the detail says what was compared.
  const parts: string[] = [];
  if (c.status === "unavailable") parts.push(c.note ?? "");
  else if (c.kind === "spread") parts.push(`${c.found ?? "—"} bps, ${c.expected}`, c.note ?? "");
  else parts.push(c.status === "pass" ? show(c.found) : `ledger ${show(c.expected)}, found ${show(c.found)}`);
  return parts.filter(Boolean).join(" · ");
}

/** Every re-verify check in the status table's rows: green matches, red differs, grey could not run (and why). */
export function ReverifyChecks({ report }: { report: ReverifyReport }) {
  return (
    <div className="status-table">
      <div className="status-table-body">
        {report.checks.map((c) => (
          <div key={c.id} className="status-row">
            <span className="status-dot" data-tone={PROOF.tones[c.status]} aria-hidden />
            <span className="status-row-label">{label(c)}</span>
            <span className="status-row-lag">{PROOF.status[c.status]}</span>
            <span className="status-row-detail" title={detail(c)}>
              {detail(c)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
