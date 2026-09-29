import { readFileSync } from "node:fs";
import { ledgerEnvSchema } from "@agari/ledger";
import { z } from "zod";

/**
 * The web tier's server-side configuration for the seat and ledger routes (plan "Performance and libraries": env parsed
 * in `instrumentation.ts` with zod 4, failing loudly in production). Nothing here is `NEXT_PUBLIC_`: the browser never
 * sees a party id it was not leased, a secret, or the ledger credential. Only variable NAMES are ever printed.
 *
 * Parties come from the bootstrap's `parties.json` (`AGARI_PARTIES_FILE`: `{ venue, seats: [...], personas: { alice,
 * bob, outsider } }`), and any of them can be overridden by its own variable.
 */
const party = z.string().regex(/^[A-Za-z0-9_\-:.]+::[0-9a-f]{68}$/, "a Canton party id (<hint>::1220<fingerprint>)");
const secret = z.string().min(32, "at least 32 characters");

export const webServerEnvSchema = z.object({
  DATABASE_URL: z.url().optional(),
  AGARI_SEAT_COOKIE_SECRET: secret.optional(),
  OPS_INTERNAL_URL: z.url().optional(),
  OPS_INTERNAL_SECRET: secret.optional(),
  AGARI_PARTIES_FILE: z.string().min(1).optional(),
  AGARI_VENUE_PARTY: party.optional(),
  /** Comma-separated seat parties; the lease pool. */
  AGARI_SEAT_PARTIES: z.string().optional(),
  AGARI_PERSONA_ALICE: party.optional(),
  AGARI_PERSONA_BOB: party.optional(),
  AGARI_PERSONA_OUTSIDER: party.optional(),
  AGARI_SEAT_IDLE_TTL_SEC: z.coerce.number().int().positive().default(900),
  AGARI_SEAT_HARD_CAP_SEC: z.coerce.number().int().positive().default(14_400),
});

export type WebServerEnv = z.output<typeof webServerEnvSchema>;

/**
 * One parties file for web and ops (K-026). Ops and `scripts/bootstrap-local.ts` write
 * `{ network, parties: { venue, resolver, … }, users: { alice, bob, outsider, "seat-1", … } }`. The web reads the venue from
 * `parties`, the personas from `users.alice|bob|outsider`, and the seat pool from every `users` entry named `seat-*`.
 * The older web-only shape `{ venue, seats, personas }` is still accepted.
 */
const partiesFileSchema = z
  .object({
    venue: party.optional(),
    seats: z.array(party).default([]),
    personas: z.object({ alice: party.optional(), bob: party.optional(), outsider: party.optional() }).default({}),
    parties: z.record(z.string(), party).optional(),
    users: z.record(z.string(), party).optional(),
  })
  .transform((f) => {
    const users = f.users ?? {};
    const seatUsers = Object.entries(users)
      .filter(([name]) => name.startsWith("seat-"))
      .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
      .map(([, p]) => p);
    return {
      venue: f.venue ?? f.parties?.venue,
      seats: f.seats.length > 0 ? f.seats : seatUsers,
      personas: {
        alice: f.personas.alice ?? users.alice,
        bob: f.personas.bob ?? users.bob,
        outsider: f.personas.outsider ?? users.outsider,
      },
    };
  });

export interface SeatParties {
  venue: string | null;
  seats: string[];
  personas: { alice: string | null; bob: string | null; outsider: string | null };
}

export function seatParties(env: WebServerEnv): SeatParties {
  const file = env.AGARI_PARTIES_FILE ? partiesFileSchema.parse(JSON.parse(readFileSync(env.AGARI_PARTIES_FILE, "utf8"))) : null;
  const listed = env.AGARI_SEAT_PARTIES?.split(",").map((s) => s.trim()).filter(Boolean);
  const seats = listed && listed.length > 0 ? listed.map((s) => party.parse(s)) : (file?.seats ?? []);
  return {
    venue: env.AGARI_VENUE_PARTY ?? file?.venue ?? null,
    seats: [...new Set(seats)],
    personas: {
      alice: env.AGARI_PERSONA_ALICE ?? file?.personas.alice ?? null,
      bob: env.AGARI_PERSONA_BOB ?? file?.personas.bob ?? null,
      outsider: env.AGARI_PERSONA_OUTSIDER ?? file?.personas.outsider ?? null,
    },
  };
}

export interface EnvCheck {
  problems: string[];
  env: WebServerEnv | null;
}

/**
 * Every problem with the seat and ledger configuration, by variable name. In production each of these is fatal at
 * boot; in development the seat routes answer "not live" instead, so the rest of the app still runs.
 */
export function checkWebServerEnv(source: Record<string, string | undefined> = process.env): EnvCheck {
  const problems: string[] = [];
  const ledger = ledgerEnvSchema.safeParse({ ...source, LEDGER_AUTH_MODE: source.LEDGER_AUTH_MODE ?? "none" });
  if (!ledger.success) for (const i of ledger.error.issues) problems.push(`${i.path.join(".") || "LEDGER_*"}: ${i.message}`);
  const parsed = webServerEnvSchema.safeParse(source);
  if (!parsed.success) {
    for (const i of parsed.error.issues) problems.push(`${i.path.join(".")}: ${i.message}`);
    return { problems, env: null };
  }
  const env = parsed.data;
  const required: (keyof WebServerEnv)[] = ["DATABASE_URL", "AGARI_SEAT_COOKIE_SECRET", "OPS_INTERNAL_URL", "OPS_INTERNAL_SECRET"];
  for (const name of required) if (env[name] === undefined) problems.push(`${name}: required for the seat routes`);
  try {
    const parties = seatParties(env);
    if (!parties.venue) problems.push("AGARI_VENUE_PARTY: required (or `venue` in AGARI_PARTIES_FILE)");
    if (parties.seats.length === 0) problems.push("AGARI_SEAT_PARTIES: at least one seat party (or `seats` in AGARI_PARTIES_FILE)");
    const infra = new Set([parties.venue, ...Object.values(parties.personas)].filter(Boolean));
    if (parties.seats.some((s) => infra.has(s))) problems.push("AGARI_SEAT_PARTIES: a seat party is also the venue or a persona");
  } catch (error) {
    problems.push(`AGARI_PARTIES_FILE: ${error instanceof Error ? error.message.split("\n")[0] : "unreadable"}`);
  }
  return { problems, env };
}
