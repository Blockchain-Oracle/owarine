"use client";

import type { ReverifyReport } from "@owarine/core/proof";
import { formatUtc } from "@owarine/core/units";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PROOF } from "./copy";
import { ReverifyChecks } from "./ReverifyChecks";

type RefusalCode = keyof typeof PROOF.refused;

export interface ReverifyResult {
  report: ReverifyReport;
  atMs: number;
}

/**
 * "Re-verify": asks the server to recompute the Window's result from the Resolution's evidence, hash the archived
 * exchange responses and re-fetch each candle (POST /api/proof/pyth, one run per Window per minute), then lists every
 * check as it came back. `preview` renders a canned result for `/dev` fixtures.
 */
export function ReverifyButton({ marketId, preview }: { marketId: string; preview?: ReverifyResult }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReverifyResult | null>(preview ?? null);
  const [note, setNote] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/proof/pyth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ market: marketId }) });
      const body = (await response.json().catch(() => null)) as (ReverifyResult & { code?: string }) | null;
      if (response.ok && body?.report) {
        setResult({ report: body.report, atMs: body.atMs });
        return;
      }
      const code = (body?.code && body.code in PROOF.refused ? body.code : "failed") as RefusalCode;
      setNote(PROOF.refused[code]);
    } catch {
      setNote(PROOF.refused.failed);
    } finally {
      setBusy(false);
    }
  };

  const report = result?.report;
  return (
    <div className="proof-reverify-panel">
      <div className="proof-reverify">
        {report && (
          <span className={report.verdict === "pass" ? "type-caption text-profit" : "type-caption text-loss"} role="status">
            {report.verdict === "pass" ? PROOF.verdict.pass(report.passed, report.unavailable) : PROOF.verdict.fail(report.failed)}
            {result && ` · ${PROOF.checkedAt(formatUtc(result.atMs))}`}
          </span>
        )}
        <Button variant="secondary" size="xs" disabled={busy} aria-busy={busy} onClick={() => void start()}>
          {busy ? PROOF.reverifying : PROOF.reverify}
        </Button>
      </div>
      {note && <span className="type-caption text-warning">{note}</span>}
      {report && <ReverifyChecks report={report} />}
    </div>
  );
}
