"use client";

import { diagnosisCopy } from "@agari/core/copy";
import { createSeatLink, decideSeatLink, readSeatLink, type SeatLinkCode } from "@agari/markets";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { leasedOf, seatNumberOf, useSeatLeaseState } from "@/providers/wallet/seat-lease-context";
import { useWalletShell } from "@/providers/wallet/wallet-shell-context";
import { SEAT } from "./copy";
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
  const [waitingKey, setWaitingKey] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const fresh = useCallback(async () => {
    const answer = await createSeatLink();
    if (answer.ok) {
      setIssued(answer.value);
      setState("showing");
      setWaitingKey(null);
      setProblem(null);
    } else setProblem(diagnosisCopy(answer.diagnosis.kind).headline);
  }, []);

  useEffect(() => {
    if (holder && issued === null) void fresh();
  }, [holder, issued, fresh]);

  // While the code shows, and while a device waits on it, the holder's screen follows it (C4c: it asks before linking).
  useEffect(() => {
    if (!issued || (state !== "showing" && state !== "confirm")) return;
    const timer = setInterval(() => {
      void readSeatLink(issued.code).then((answer) => {
        if (!answer.ok) return;
        const next = answer.value.state === "pending" ? "confirm" : answer.value.state;
        if (next === "confirm") setWaitingKey(answer.value.device);
        if (next !== state) setState(next);
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [issued, state]);

  const decide = useCallback(
    async (allow: boolean) => {
      if (!issued) return;
      const answer = await decideSeatLink(issued.code, allow);
      if (answer.ok) setState(answer.value.state);
      else {
        setState("expired");
        setProblem(diagnosisCopy(answer.diagnosis.kind).headline);
      }
    },
    [issued],
  );

  const verify = useCallback(
    async (code: string) => {
      const joined = await shell.joinSeat(code);
      if (joined.ok) return joined.value.kind === "leased";
      if (joined.status === 403) return SEAT.link.joinDeclined;
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
        waitingKey={waitingKey}
        onDecide={decide}
        onFresh={() => void fresh()}
        verify={verify}
        joinDefault={joinDefault}
      />
      {problem ? (
        <div className="cx-link-problem">
          <p className="cx-link-foot" role="alert">
            {problem}
          </p>
          {/* The seat's holder whose first code did not issue has nothing on screen to press: offer the retry. */}
          {holder && issued === null && (
            <Button type="button" variant="secondary" size="sm" onClick={() => void fresh()}>
              <RefreshCw aria-hidden /> {SEAT.link.fresh}
            </Button>
          )}
        </div>
      ) : null}
    </>
  );
}
