"use client";

import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import { diagnosisCopy } from "@agari/core/copy";
import { useRouter } from "next/navigation";
import { SeatAccountMenu } from "@/features/canton-ux/seat";
import { useBalancePlate } from "@/features/markets/balance";
import { CONNECT } from "@/lib/copy";
import { useWalletSession } from "@/lib/wallet-session";
import { WALLET_MODAL } from "@/providers/wallet/copy";
import { leasedOf, seatNumberOf, useSeatLeaseState } from "@/providers/wallet/seat-lease-context";

const AMOUNT_DP = 2;
/** The idle lease the countdown is drawn against (`AGARI_SEAT_IDLE_TTL_SEC`'s default). */
const LEASE_SPAN_SEC = 900;

/**
 * The address pill and its menu — the reference's (`Header.tsx` L322–364): the `addr-dot` avatar and the short
 * address, opening the guest seat's menu (L-02, `SeatAccountMenu`): the seat, its leased party (`Hash`), the lease time
 * left (`Countdown`), the demo cash, Portfolio, "Use on another device" (`/seat/link`) and Reset seat. A seat with no party (a lapsed or refused lease) says
 * so and offers to lease one; a balance that has not been read yet shows an em dash.
 */
export function HeaderAccount({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const session = useWalletSession();
  const balance = useBalancePlate();
  const lease = useSeatLeaseState();
  const router = useRouter();

  const reading = balance.kind === "connected" ? balance.reading : null;
  const sheet = reading && isOk(reading) ? reading.value : null;
  const amount = (value: bigint | null) =>
    sheet && value !== null ? formatBaseUnits(value, sheet.decimals, { maxDp: AMOUNT_DP, minDp: AMOUNT_DP }) : "—";

  // As in the reference once mounted, the header says "Connect" until an account is connected. That covers the first
  // paint (server and hydration agree on it), a remembered wallet still reconnecting, and a connection in flight
  // (the modal shows that progress).
  if (!session.isConnected || !session.address) {
    return (
      <button type="button" className="btn btn-primary" onClick={session.connect} data-cursor="hover">
        {CONNECT.connect}
      </button>
    );
  }

  const leased = leasedOf(lease.view);
  const state = leased ? "leased" : "unleased";
  const reason = lease.view?.kind === "refused" ? diagnosisCopy(lease.view.diagnosis.kind).headline : lease.view?.kind === "not-live" ? WALLET_MODAL.seat.notLive : null;
  return (
    <div data-cursor="hover">
      <SeatAccountMenu
        seatNumber={leased ? seatNumberOf(leased.party) : null}
        address={session.address}
        party={leased?.party ?? null}
        state={lease.view === null ? "leased" : state}
        leaseExpirySec={leased ? Math.floor(leased.idleExpiresAtMs / 1000) : null}
        leaseSpanSec={LEASE_SPAN_SEC}
        cashText={amount(sheet?.spendableBase ?? null)}
        onReset={() => void session.disconnect()}
        // Only the device that took the seat shows link codes (a joined device cannot pass the seat on).
        onLink={leased && leased.address === session.address ? () => router.push("/seat/link") : undefined}
        onLease={() => void lease.lease()}
        leasing={lease.leasing}
        unleasedReason={reason}
        onOpenMenu={onOpenMenu}
      />
    </div>
  );
}
