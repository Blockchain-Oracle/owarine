import { seatServer } from "@/lib/ledger.server";
import { leaseRules } from "@/lib/seat-lease.server";
import { STATUS } from "./copy";
import { createDiagnosticRunner, DiagnosticFailure } from "./diagnostic-runner";
import { errorText, notConfiguredRow, pipelineRow } from "./pipeline";
import type { StatusPipeline } from "./protocol";
import { seatPoolRow } from "./rows-canton";

const diagnose = createDiagnosticRunner(10_000);

/** C9d: the guest-seat pool's counts, read from the pool table the lease route uses. Optional where no pool is set up. */
export async function probeSeats(nowMs: number): Promise<StatusPipeline> {
  const label = STATUS.pipelines.seats;
  const state = seatServer();
  if (!state.ok) return notConfiguredRow("seats", label, STATUS.detail.seatsOff(state.reason));
  try {
    const { value, elapsedMs } = await diagnose("seats", ({ step }) => step("Seat pool counts", () => state.server.store.stats(nowMs, leaseRules(state.server))));
    return seatPoolRow(value, nowMs, elapsedMs);
  } catch (error) {
    return pipelineRow("seats", label, { verdict: "bad", detail: errorText(error), latencyMs: error instanceof DiagnosticFailure ? error.elapsedMs : null });
  }
}
