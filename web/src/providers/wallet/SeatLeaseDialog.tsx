"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { DrainingPlate, PoolFullPlate } from "@/features/canton-ux/seat";
import { POOL_SPAN_SEC, poolFullOf } from "@/features/canton-ux/seat/pool";
import { WALLET_MODAL } from "./copy";
import { useSeatLeaseState } from "./seat-lease-context";
import { CloseButton, WalletDialog } from "./wallet-modal-parts";

const L = WALLET_MODAL.lease;
const toSec = (ms: number | null) => (ms === null ? null : Math.ceil(ms / 1000));

/**
 * The seat's lease when it is not simply held (plan §4, C-ADD-10): the pool-full plate while this page waits in line
 * (it asks again by itself, so there is nothing to press), the draining plate after a reset that left calls open, and
 * the refusal with its reason. It opens only after the reader asked for a seat, or reset one.
 */
export function SeatLeaseDialog({ asked, onDismiss }: { asked: boolean; onDismiss: () => void }) {
  const lease = useSeatLeaseState();
  const view = lease.view;
  const closing = lease.closing;
  const waiting = asked && view !== null && view.kind !== "leased";
  const open = closing !== null || waiting;

  const dismiss = () => {
    if (closing) lease.dismissClosing();
    else onDismiss();
  };

  return (
    <WalletDialog open={open} onOpenChange={(next) => !next && dismiss()} compact>
      <div className="wm-profile">
        <div className="wm-profile-close">
          <CloseButton />
        </div>
        <Dialog.Title className="sr-only">{L.title}</Dialog.Title>
        <div className="flex flex-col gap-4 pt-8">
          {closing ? (
            <DrainingPlate atSec={toSec(closing.atMs)} spanSec={POOL_SPAN_SEC} openCalls={closing.openCalls} />
          ) : view?.kind === "pool-full" ? (
            <PoolFullPlate {...poolFullOf(view)} />
          ) : view?.kind === "refused" ? (
            <ErrorState diagnosis={view.diagnosis} retry={() => void lease.lease()} />
          ) : view?.kind === "not-live" || view?.kind === "none" ? (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-4">
              <p className="type-body-strong text-ink">{L.refusedTitle}</p>
              <p className="type-caption text-ink-secondary" title={view.kind === "not-live" ? view.reason : undefined}>
                {L.notLiveBody}
              </p>
            </div>
          ) : null}
          <Button type="button" variant="secondary" className="w-full" disabled={lease.leasing} onClick={dismiss}>
            {view?.kind === "pool-full" && !closing ? L.wait : L.close}
          </Button>
        </div>
      </div>
    </WalletDialog>
  );
}
