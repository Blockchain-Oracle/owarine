/**
 * push-clock (S26.4): the phone push drain's clock. Every tick it asks web's `/api/push/drain` to send whatever the
 * registered phones are owed; the choosing and the words live in web beside the in-tab notifications, so a push and
 * an in-app alert can never disagree. Heartbeat detail = the last drain's report (devices, sent, failed, retired).
 *
 * Env: `PUSH_DRAIN_SECRET` (shared with web; without it the actor idles and says why), `PUSH_DRAIN_URL` (default
 * `<NEXT_PUBLIC_SITE_URL>/api/push/drain`; with neither the actor idles and says why), `PUSH_CLOCK_MS` (default 15 s,
 * the inbox's own poll).
 *
 * C5d: there is no fallback host. It used to be the reference's production domain, so a local ops with the secret set
 * and no site URL sent its bearer secret to a site this product does not run (seen on the C5d stack, 401).
 */
import { runActor, type Log } from "../../runtime/actor";

/** The drain this ops asks, or null when nothing names one. */
export function drainUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.PUSH_DRAIN_URL?.trim();
  if (explicit) return explicit;
  const site = env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return site ? `${site}/api/push/drain` : null;
}
const EVERY_MS = Number(process.env.PUSH_CLOCK_MS) || 15_000;
/** Idle re-check when the secret is missing: nothing to do until someone sets it and restarts. */
const UNCONFIGURED_MS = 10 * 60_000;

interface DrainReport {
  configured: boolean;
  devices: number;
  wallets: number;
  sent: number;
  failed: number;
  retired: number;
  firstError: string | null;
}

export async function startPushClock(log: Log): Promise<{ stop: () => void }> {
  const secret = process.env.PUSH_DRAIN_SECRET?.trim() ?? "";
  const url = drainUrl();
  const { stop } = runActor({
    name: "push-clock",
    log,
    dryRun: false,
    everyMs: EVERY_MS,
    pass: async () => {
      if (!secret) return { why: "PUSH_DRAIN_SECRET not set: no phone push is sent", nextDelayMs: UNCONFIGURED_MS };
      if (!url) return { why: "neither PUSH_DRAIN_URL nor NEXT_PUBLIC_SITE_URL is set: no phone push is sent", nextDelayMs: UNCONFIGURED_MS };
      const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(60_000) });
      if (res.status === 409) return { why: "previous drain still running" };
      if (!res.ok) throw new Error(`drain ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const report = (await res.json()) as DrainReport;
      if (!report.configured) return { why: "web has no database: no phone push is sent", detail: { ...report }, nextDelayMs: UNCONFIGURED_MS };
      const error = report.firstError ? ` · first error ${report.firstError}` : "";
      return {
        why: `${report.devices} phones on ${report.wallets} wallets · sent ${report.sent}, failed ${report.failed}, retired ${report.retired}${error}`,
        detail: { ...report, url },
      };
    },
  });
  return { stop };
}
