/**
 * window-roller (plan §4, "Venue operations"): lists Windows back-to-back on every venue `Series` by the unchanged pure
 * planners (Regular on the agreed session calendar, 24/7 token and crypto lanes by clock), opening each through the
 * consuming `Series_OpenWindow`. One writer: the venue party. Dry-run by default (prepare-only); no venue party means
 * scan-and-report.
 */
import { runActor } from "../../runtime/actor";
import type { VenueDeps } from "../../runtime/deps";
import { createVenueContext, type VenueContext } from "../venue/context";
import { rollerPass, type RollerSettings, type RollerState } from "./execute";
import { DEFAULT_GAP_LEAD_SEC, DEFAULT_LEAD_SEC, DEFAULT_MIN_TRADABLE_SEC, DEFAULT_PRELIST, DEFAULT_PRELIST_CADENCES_SEC } from "./plan";

const intEnv = (raw: string | undefined, fallback: number) => (raw && Number.isInteger(Number(raw)) && Number(raw) > 0 ? Number(raw) : fallback);
const boolEnv = (raw: string | undefined, fallback: boolean) => (raw === undefined || raw === "" ? fallback : !["0", "false", "off", "no"].includes(raw.toLowerCase()));

/** `ROLLER_PRELIST_CADENCES=300,900`; unknown or empty falls back to every Regular cadence. */
function cadences(raw: string | undefined): number[] {
  const picked = (raw ?? "").split(",").map(Number).filter((n) => DEFAULT_PRELIST_CADENCES_SEC.includes(n));
  return picked.length ? picked : DEFAULT_PRELIST_CADENCES_SEC;
}

export function readRollerSettings(env: NodeJS.ProcessEnv = process.env): RollerSettings {
  return {
    leadSec: intEnv(env.ROLLER_LEAD_SEC, DEFAULT_LEAD_SEC),
    gapLeadSec: intEnv(env.ROLLER_GAP_LEAD_SEC, DEFAULT_GAP_LEAD_SEC),
    minTradableSec: intEnv(env.ROLLER_MIN_TRADABLE_SEC, DEFAULT_MIN_TRADABLE_SEC),
    prelist: boolEnv(env.ROLLER_PRELIST, DEFAULT_PRELIST),
    prelistCadencesSec: cadences(env.ROLLER_PRELIST_CADENCES),
    only: (env.ROLLER_SERIES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

export async function startWindowRoller(deps: VenueDeps, venue: VenueContext = createVenueContext()): Promise<{ stop: () => void }> {
  const session = venue.session("venue");
  if (!session) {
    deps.log("VENUE_PARTY and the parties file are missing: the roller has nothing to act as");
    return runActor({ name: "window-roller", log: deps.log, dryRun: true, everyMs: 60_000, pass: async () => ({ why: "no venue party: scanning and reporting only" }) });
  }
  const settings = readRollerSettings();
  const state: RollerState = { venue: session, settings, counters: { opened: 0, skipped: 0, failed: 0 }, last: new Map() };
  deps.log(`roller as ${session.party.split("::")[0]}, lead ${settings.leadSec} s, min tradable ${settings.minTradableSec} s${settings.only.length ? `, only ${settings.only.join(",")}` : ""} · ${venue.summary}`);
  const { stop } = runActor({ name: "window-roller", log: deps.log, dryRun: session.dryRun, everyMs: 5_000, pass: () => rollerPass(state, deps) });
  return { stop };
}
