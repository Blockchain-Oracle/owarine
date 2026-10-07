/**
 * The loop every venue actor runs (venue-ops.md §2.2): one pass at a time, a structured why-string per pass, backoff
 * on failure, and a heartbeat either way. Identical consecutive whys are logged once a minute, so idle is a heartbeat,
 * never silence and never spam.
 */
import { randomBytes } from "node:crypto";
import { errorText } from "./env";
import { registerHeartbeat, type Heartbeat } from "./heartbeat";

export type Log = (why: string) => void;

/** What one pass reports: the why-string, optional heartbeat detail, and when to run next (default `everyMs`). */
export type PassResult = { why: string; detail?: Record<string, unknown>; nextDelayMs?: number };

export interface ActorSpec {
  name: string;
  log: Log;
  dryRun: boolean;
  everyMs: number;
  pass: (beat: Heartbeat) => Promise<PassResult>;
}

const REPEAT_LOG_MS = 60_000;
const MAX_BACKOFF_MS = 60_000;

/**
 * Runs `spec.pass` until `stop()`. Never throws. `wake()` cuts the current rest short (an event the actor waits on has
 * happened, e.g. a print landed); a wake during a pass makes the next rest zero, so it is never lost.
 */
export function runActor(spec: ActorSpec): { stop: () => void; wake: () => void; beat: Heartbeat } {
  const beat = registerHeartbeat(spec.name, spec.dryRun, spec.everyMs);
  let stopped = false;
  let woken = false;
  let cutRest: (() => void) | null = null;
  const rest = (ms: number) =>
    new Promise<void>((resolve) => {
      if (woken || ms <= 0) return resolve();
      const timer = setTimeout(() => ((cutRest = null), resolve()), ms);
      cutRest = () => {
        clearTimeout(timer);
        cutRest = null;
        resolve();
      };
    });
  let lastLogged = { why: "", atMs: 0 };
  const say = (why: string) => {
    const now = Date.now();
    if (why === lastLogged.why && now - lastLogged.atMs < REPEAT_LOG_MS) return;
    lastLogged = { why, atMs: now };
    spec.log(why);
  };
  void (async () => {
    spec.log(spec.dryRun ? "start (DRY RUN: nothing is signed)" : "start");
    while (!stopped) {
      woken = false;
      let delay = spec.everyMs;
      beat.passStartedMs = Date.now();
      try {
        const result = await spec.pass(beat);
        beat.lastOkMs = Date.now();
        beat.failures = 0;
        beat.lastWhy = result.why;
        if (result.detail) beat.detail = result.detail;
        say(result.why);
        delay = result.nextDelayMs ?? spec.everyMs;
        // A pass that announces a longer rest (an unconfigured actor idling 10 min) is not silent during it: `/health`
        // measures silence against `everyMs`, so it tracks the interval the actor is actually keeping.
        beat.everyMs = Math.max(spec.everyMs, delay);
      } catch (error) {
        beat.failures += 1;
        // `/health` is public (C4d L4): it names the failure by a reference only; the log keeps the full text.
        const ref = randomBytes(4).toString("hex");
        beat.lastWhy = `pass failed (ref ${ref})`;
        say(`${beat.lastWhy}: ${errorText(error)}`);
        delay = Math.min(spec.everyMs * 2 ** beat.failures, MAX_BACKOFF_MS);
      }
      beat.lastPassMs = Date.now();
      beat.passStartedMs = null;
      await rest(Math.max(0, delay));
    }
  })();
  const wake = () => {
    woken = true;
    cutRest?.();
  };
  return { stop: () => ((stopped = true), wake()), wake, beat };
}
