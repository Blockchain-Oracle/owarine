"use client";

import { Check, Copy, Link2, RefreshCw, ShieldQuestion } from "lucide-react";
import { formatClock, shortHex } from "@agari/core/units";
import { formatSeatLinkCode, SEAT_LINK_CODE_LENGTH } from "@agari/markets";
import { useEffect, useId, useRef, useState } from "react";
import { useNowMs } from "@/components/data/useNowMs";
import { Button } from "@/components/ui/button";
import { OtpInput, type OtpInputHandle, type OtpStatus } from "@/components/ui/otp-input";
import { SEAT } from "./copy";
import { SeatQr } from "./SeatQr";
import "./seat.css";

const L = SEAT.link;
const COPIED_MS = 1_500;
export const LINK_CODE_LENGTH = SEAT_LINK_CODE_LENGTH;
export const LINK_TTL_SEC = 60;

/**
 * `join`: this device holds no seat of its own to show, so the card is only the code entry. `confirm`: a device used
 * this seat's code and waits for this one to allow it (C4c); `declined`: this device refused it.
 */
export type SeatLinkState = "showing" | "expired" | "confirm" | "linked" | "declined" | "join";

interface SeatLinkCardProps {
  state: SeatLinkState;
  /** The one-time code (eight letters and numbers) and the link the QR carries (`<origin>/seat/link?code=…`). */
  code: string;
  url: string;
  /** When the code stops working, in epoch seconds; ticks locally. */
  expiresAtSec: number | null;
  seatNumber: number;
  /** The device that joined, named as the lease records it. */
  linkedDevice?: string;
  /** `confirm`: the key waiting on this seat's code, and this device's answer to it. */
  waitingKey?: string | null;
  onDecide?: (allow: boolean) => Promise<void>;
  onFresh: () => void;
  /**
   * Checks a code typed on this device; the fixture answers from a canned code, the app from `/api/seat/link/join`.
   * True joins; false or a sentence refuses (the sentence replaces the generic error line).
   */
  verify: (code: string) => Promise<boolean | string>;
  /** Fixtures only: the entry's first state. */
  joinDefault?: { value: string; status: OtpStatus };
  /** The title's heading level: 2 among a fixture page's sections, 1 when the card is the page (`/seat/link`). */
  headingLevel?: 1 | 2;
}

function CopyCode({ code, disabled }: { code: string; disabled: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="cx-link-code">
      <output className="cx-link-code-value" aria-label={L.code}>
        {disabled ? "–––– ––––" : formatSeatLinkCode(code)}
      </output>
      <button type="button" className="cx-link-copy" disabled={disabled} aria-label={copied ? L.copied : L.copy} onClick={() => void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => undefined)}>
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </button>
    </div>
  );
}

function Join({ verify, joinDefault }: Pick<SeatLinkCardProps, "verify" | "joinDefault">) {
  const field = useRef<OtpInputHandle>(null);
  const [value, setValue] = useState(joinDefault?.value ?? "");
  const [status, setStatus] = useState<OtpStatus>(joinDefault?.status ?? "idle");
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const submit = async (code: string) => {
    if (code.length !== LINK_CODE_LENGTH || busy) return;
    setBusy(true);
    const answer = await verify(code);
    setBusy(false);
    setWhy(typeof answer === "string" ? answer : null);
    setStatus(answer === true ? "success" : "error");
  };
  return (
    <form
      className="cx-link-join"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(value);
      }}
    >
      <p className="cx-link-join-title">{L.joinTitle}</p>
      <p className="cx-link-join-body">{L.joinBody}</p>
      <OtpInput
        ref={field}
        mode="alphanumeric"
        length={LINK_CODE_LENGTH}
        groupEvery={LINK_CODE_LENGTH / 2}
        defaultValue={joinDefault?.value}
        label={L.joinLabel}
        status={status}
        hint={L.joinHint}
        errorMessage={why ?? L.joinError}
        successMessage={L.joinSuccess}
        focusOnError={joinDefault?.status !== "error"}
        onChange={(v) => {
          setValue(v);
          if (status !== "idle") setStatus("idle");
        }}
        onComplete={(v) => void submit(v)}
        className="cx-link-otp"
      />
      <Button type="submit" className="cx-link-submit w-full" disabled={value.length !== LINK_CODE_LENGTH || busy || status === "success"} aria-busy={busy}>
        {busy ? L.joining : L.join}
      </Button>
    </form>
  );
}

/**
 * The seat link between devices (C-ADD-03), laid out as 21st #29246 "Two-Factor Authentication Card" (author
 * diarmuradi; pulled with `21st get 29246` on 2026-09-29; no licence declared in the registry payload): a mark and a
 * title, the QR beside a manual code with copy, then code entry and one button. Rebuilt on the reference's primitives:
 * the QR from `qrcode-generator`, the time left from `Countdown`, the reference `Button`, and code entry from the
 * adapted OTP Input (21st #23543). The top half is this device's code for another; the bottom half joins another's.
 */
function Decide({ waitingKey, seatNumber, onDecide }: { waitingKey: string; seatNumber: number; onDecide: (allow: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const answer = (allow: boolean) => {
    setBusy(true);
    void onDecide(allow).finally(() => setBusy(false));
  };
  return (
    <div className="cx-link-done" data-tone="ask" role="alertdialog" aria-live="assertive" aria-labelledby={titleId} aria-describedby={bodyId}>
      <span className="cx-link-done-mark" aria-hidden>
        <ShieldQuestion />
      </span>
      <p id={titleId} className="cx-link-done-title">
        {L.confirmTitle}
      </p>
      <p id={bodyId} className="cx-link-done-body">
        {L.confirmBody(shortHex(waitingKey, 4, 4), seatNumber)}
      </p>
      <div className="flex w-full gap-2">
        <Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={() => answer(false)}>
          {L.decline}
        </Button>
        <Button type="button" className="flex-1" disabled={busy} aria-busy={busy} onClick={() => answer(true)}>
          {busy ? L.deciding : L.allow}
        </Button>
      </div>
    </div>
  );
}

export function SeatLinkCard({ state, code, url, expiresAtSec, seatNumber, linkedDevice = "Your iPhone", waitingKey = null, onDecide, onFresh, verify, joinDefault, headingLevel = 2 }: SeatLinkCardProps) {
  const titleId = useId();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const now = useNowMs();
  const leftSec = expiresAtSec !== null && now > 0 ? Math.max(0, Math.ceil(expiresAtSec - now / 1000)) : null;
  // A code that runs out on screen turns into the expired state by itself; it never shows a stale code as live.
  const expired = state === "expired" || leftSec === 0;
  return (
    <section className="cx-link" aria-labelledby={titleId} data-state={expired && state !== "linked" ? "expired" : state}>
      <header className="cx-link-head">
        <span className="cx-link-mark" aria-hidden>
          <Link2 />
        </span>
        <Heading id={titleId} className="cx-link-title">
          {L.title}
        </Heading>
        <p className="cx-link-sub">{L.subtitle}</p>
      </header>

      {state === "join" ? null : state === "confirm" && waitingKey && onDecide ? (
        <Decide waitingKey={waitingKey} seatNumber={seatNumber} onDecide={onDecide} />
      ) : state === "declined" ? (
        <div className="cx-link-done" data-tone="declined" role="status">
          <p className="cx-link-done-title">{L.declinedTitle}</p>
          <p className="cx-link-done-body">{L.declinedBody}</p>
          <Button type="button" variant="secondary" size="sm" onClick={onFresh}>
            <RefreshCw aria-hidden /> {L.fresh}
          </Button>
        </div>
      ) : state === "linked" ? (
        <div className="cx-link-done" role="status">
          <span className="cx-link-done-mark" aria-hidden>
            <Check />
          </span>
          <p className="cx-link-done-title">{L.linkedTitle}</p>
          <p className="cx-link-done-body">{L.linkedBody(linkedDevice, seatNumber)}</p>
        </div>
      ) : (
        <div className="cx-link-show">
          <div className="cx-link-qr-frame">
            <SeatQr text={url} label={L.qrAlt} className="cx-link-qr" />
            {expired && (
              <div className="cx-link-qr-veil">
                <span>{L.expired}</span>
              </div>
            )}
            <span className="cx-link-corner" data-at="tl" aria-hidden />
            <span className="cx-link-corner" data-at="tr" aria-hidden />
            <span className="cx-link-corner" data-at="bl" aria-hidden />
            <span className="cx-link-corner" data-at="br" aria-hidden />
          </div>
          <div className="cx-link-side">
            <p className="cx-link-manual">{L.manual}</p>
            <CopyCode code={code} disabled={expired} />
            {expired ? (
              <>
                <p className="cx-link-expiry" data-expired="">
                  {L.expiredBody}
                </p>
                <Button type="button" variant="secondary" size="sm" onClick={onFresh}>
                  <RefreshCw aria-hidden /> {L.fresh}
                </Button>
              </>
            ) : (
              <p className="cx-link-expiry">
                {L.expiresIn}{" "}
                <span role="timer" className="numbers">
                  {leftSec !== null ? formatClock(leftSec) : "–:––"}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      <Join verify={verify} joinDefault={joinDefault} />
      <p className="cx-link-foot">{L.foot}</p>
    </section>
  );
}
