"use client";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { CountdownRing } from "@/components/kit";
import { STATUS } from "./copy";
import { StatusBanner, StatusTable } from "./StatusRows";
import { useStatus } from "./useStatus";

/** `/api/status` is re-read every 30 s (useStatus). */
const POLL_MS = 30_000;

/**
 * `/status`: the venue's board (8 Oct revamp). `/api/status` makes every read itself at request time and the page shows
 * exactly what came back — the verdict as the hero, what needs attention, then every check by the system it watches.
 * Three states, as the reference has them: loading, unreachable, and the report.
 */
export function StatusScreen() {
  const reading = useStatus();

  return (
    <div className="container flex flex-col gap-8 py-8">
      {reading === null && (
        <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 text-ow-muted" role="status" aria-busy="true">
          <RefreshCwIcon className="size-6 animate-spin" aria-hidden />
          <p className="text-ow-lead">{STATUS.loading}</p>
        </div>
      )}

      {reading !== null && !reading.ok && (
        <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 rounded-ow-feature bg-ow-down-line/10 p-8 text-center ring-1 ring-ow-down-line/30" role="alert">
          <AlertTriangleIcon className="size-8 text-ow-down" aria-hidden />
          <p className="ow-display ow-display-sm">{STATUS.board.verdict.unreachable}</p>
          <p className="text-ow-lead text-ow-muted">{STATUS.unreachable}</p>
        </div>
      )}

      {reading?.ok && (
        <>
          <StatusBanner payload={reading.value} />
          <StatusTable pipelines={reading.value.pipelines} sessionLabel={reading.value.session?.label ?? null} />
          <footer className="flex items-center justify-center gap-3 text-ow-label text-ow-muted">
            <CountdownRing key={reading.value.checkedAtMs} startMs={reading.value.checkedAtMs} endMs={reading.value.checkedAtMs + POLL_MS} size={28} />
            <span>
              {STATUS.board.checked(new Date(reading.value.checkedAtMs).toLocaleTimeString())} · {STATUS.board.refresh}
            </span>
          </footer>
        </>
      )}
    </div>
  );
}
