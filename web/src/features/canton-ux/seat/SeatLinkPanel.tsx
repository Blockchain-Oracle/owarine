"use client";

import { diagnosisCopy } from "@agari/core/copy";
import { createSeatLink, readSeatLink, type SeatLinkCode } from "@agari/markets";
import { useCallback, useEffect, useState } from "react";
import { leasedOf, seatNumberOf, useSeatLeaseState } from "@/providers/wallet/seat-lease-context";
import { useWalletShell } from "@/providers/wallet/wallet-shell-context";
import { appSeatLinkUrl } from "./link";
import { SeatLinkCard, type SeatLinkState } from "./SeatLinkCard";

/** How often the holder's screen asks whether its code was used, while it shows. */
const POLL_MS = 2_000;

/**
 * `/seat/link` (plan, iOS step 2b): the seat link card on live state. The device that took the seat shows a fresh code
 * and its QR (the app's deep link) and turns to "Linked" once another device joins; any device can join another's
 * seat with its code (a device with no seat, or one joined elsewhere, sees only the entry). `?code=` fills the entry.
 */
export function SeatLinkPanel({ initialCode }: { initialCode: string | null }) {
  const shell = useWalletShell();
  const lease = useSeatLeaseState();
  const leased = leasedOf(lease.view);
  const holder = leased !== null && shell.address !== null && leased.address === shell.address;
  const [issued, setIssued] = useState<SeatLinkCode | null>(null);
  const [state, setState] = useState<Exclude<SeatLinkState, "join">>("showing");
  const [problem, setProblem] = useState<string | null>(null);

  const fresh = useCallback(async () => {
    const answer = await createSeatLink();
    if (answer.ok) {
      setIssued(answer.value);
      setState("showing");
      setProblem(null);
    } else setProblem(diagnosisCopy(answer.diagnosis.kind).headline);
  }, []);

  useEffect(() => {
    if (holder && issued === null) void fresh();
  }, [holder, issued, fresh]);

  useEffect(() => {
    if (!issued || state !== "showing") return;
    const timer = setInterval(() => {
      void readSeatLink(issued.code).then((answer) => {
        if (answer.ok && answer.value !== "showing") setState(answer.value);
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [issued, state]);

  const verify = useCallback(
    async (code: string) => {
      const joined = await shell.joinSeat(code);
      if (joined.ok) return joined.value.kind === "leased";
      return joined.status === 410 ? false : joined.diagnosis.technical;
    },
    [shell],
  );

  const joinDefault = initialCode ? { value: initialCode, status: "idle" as const } : undefined;
  return (
    <>
      <SeatLinkCard
        state={holder && issued ? state : "join"}
        code={issued?.code ?? ""}
        url={issued ? appSeatLinkUrl(issued.code) : ""}
        expiresAtSec={issued ? Math.floor(issued.expiresAtMs / 1000) : null}
        seatNumber={(leased && seatNumberOf(leased.party)) ?? 0}
        onFresh={() => void fresh()}
        verify={verify}
        joinDefault={joinDefault}
      />
      {problem ? (
        <p className="cx-link-foot" role="alert">
          {problem}
        </p>
      ) : null}
    </>
  );
}
