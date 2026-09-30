/**
 * The DevNet parties file (C2y). Abu creates the parties in the Noders Console with the hints of
 * `docs/plan/runbooks/devnet-r1.md` step 3, then fills `docs/plan/runbooks/devnet-parties.example.json` (a copy kept
 * OUTSIDE the repo: party ids never go into Git) or pastes the Console's party list into a text file. Either form
 * normalises to the one K-026 shape web and ops read: `{ network, parties: {venue, …}, users: {alice, …, "seat-1", …} }`.
 *
 * Pure: no I/O here, so the rules are unit-tested (`devnet-parties.test.ts`).
 */
import { CANTON_ROLES, type CantonRole, type PartiesFile } from "../../services/ops/src/runtime/keys";

/** The web's party rule (`web/src/lib/server-env.ts`): `<hint>::1220<64 hex>`. A looser id would boot ops and fail the web. */
export const PARTY_ID = /^[A-Za-z0-9_\-:.]+::[0-9a-f]{68}$/;
const PARTY_IN_TEXT = /[A-Za-z0-9_\-:.]+::[0-9a-f]{68}/g;

/** The demo's three viewpoints (K-026 personas). */
export const PERSONAS = ["alice", "bob", "outsider"] as const;
/** The plan's party budget (plan "Seats"): 8 infrastructure + 3 viewpoints + about 8 visitor seats = 19 of the 20-party quota. */
export const DEFAULT_SEATS = 8;

/** The Console hint for a role or user name (`devnet-r1.md` step 3): `venue` → `pm-venue`, `seat-3` → `pm-seat-3`. */
export const hintFor = (name: string) => `pm-${name}`;

export interface ParsedParties {
  file: PartiesFile;
  /** Fatal: the bootstrap refuses to run. Names roles and users, never party ids. */
  errors: string[];
  /** Non-fatal: e.g. fewer seats than asked for, a missing persona. */
  warnings: string[];
}

/** Does a party id's local part carry this hint? Exact, or behind a namespace prefix the platform may add (`…-pm-venue`). */
function carriesHint(id: string, hint: string): boolean {
  const local = id.slice(0, id.indexOf("::"));
  return local === hint || local.endsWith(`-${hint}`) || local.endsWith(`_${hint}`) || local.endsWith(`.${hint}`);
}

/**
 * Parse what Abu filled. JSON in the K-026 shape (empty strings are unfilled slots), or any text holding party ids,
 * matched to roles by their hint. `seats` caps the seat pool; `seat-N` above it is ignored.
 */
export function parseDevnetParties(text: string, o: { seats?: number; nowMs?: number } = {}): ParsedParties {
  const seats = o.seats ?? DEFAULT_SEATS;
  const errors: string[] = [];
  const warnings: string[] = [];
  const parties: Partial<Record<CantonRole, string>> = {};
  const users: Record<string, string> = {};
  const userNames = [...PERSONAS, ...Array.from({ length: seats }, (_, i) => `seat-${i + 1}`)];

  type Filled = { parties?: Record<string, unknown>; users?: Record<string, unknown> };
  let json: Filled | null = null;
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      json = JSON.parse(trimmed) as Filled;
    } catch (e) {
      errors.push(`the parties file looks like JSON but does not parse: ${e instanceof Error ? e.message : String(e)}`);
      return { file: { network: "devnet", createdAtMs: o.nowMs ?? Date.now(), parties, users }, errors, warnings };
    }
  }

  const take = (slot: string, raw: unknown): string | undefined => {
    if (raw === undefined || raw === null || raw === "") return undefined;
    if (typeof raw !== "string" || !PARTY_ID.test(raw.trim())) {
      errors.push(`${slot}: not a Canton party id (<hint>::1220<64 hex>)`);
      return undefined;
    }
    return raw.trim();
  };

  if (json) {
    for (const key of Object.keys(json.parties ?? {})) if (!(CANTON_ROLES as readonly string[]).includes(key)) errors.push(`parties.${key}: not a role (${CANTON_ROLES.join(", ")})`);
    for (const role of CANTON_ROLES) {
      const id = take(`parties.${role}`, json.parties?.[role]);
      if (id) parties[role] = id;
    }
    for (const [name, raw] of Object.entries(json.users ?? {})) {
      const id = take(`users.${name}`, raw);
      if (!id) continue;
      if (userNames.includes(name)) users[name] = id;
      else if (/^seat-\d+$/.test(name)) warnings.push(`users.${name}: beyond the seat pool of ${seats} (--seats), left out`);
      else errors.push(`users.${name}: not a persona (${PERSONAS.join(", ")}) or seat-N`);
    }
  } else {
    const ids = [...new Set(trimmed.match(PARTY_IN_TEXT) ?? [])];
    const claimed = new Set<string>();
    const match = (name: string): string | undefined => {
      const hits = ids.filter((id) => carriesHint(id, hintFor(name)));
      if (hits.length > 1) errors.push(`${name}: ${hits.length} listed parties carry the hint ${hintFor(name)}`);
      const id = hits.length === 1 ? hits[0] : undefined;
      if (id) claimed.add(id);
      return id;
    };
    for (const role of CANTON_ROLES) {
      const id = match(role);
      if (id) parties[role] = id;
    }
    for (const name of userNames) {
      const id = match(name);
      if (id) users[name] = id;
    }
    const unclaimed = ids.filter((id) => !claimed.has(id)).length;
    if (unclaimed > 0) warnings.push(`${unclaimed} listed part${unclaimed === 1 ? "y carries" : "ies carry"} no pm-* hint this run uses (ignored)`);
  }

  for (const role of CANTON_ROLES) if (!parties[role]) errors.push(`parties.${role}: missing (Console hint ${hintFor(role)})`);
  for (const p of PERSONAS) if (!users[p]) warnings.push(`users.${p}: missing (Console hint ${hintFor(p)}); the four-viewpoint smoke needs it`);
  const seatCount = Object.keys(users).filter((n) => n.startsWith("seat-")).length;
  if (seatCount === 0) errors.push(`users.seat-*: no seat (Console hints ${hintFor("seat-1")} …); the web needs at least one`);
  else if (seatCount < seats) warnings.push(`${seatCount} of ${seats} seats filled: the seat pool runs with ${seatCount}`);

  // One party, one role: the web refuses a seat that is also the venue or a persona, and ops would act twice.
  const seen = new Map<string, string>();
  const slots: Array<[string, string]> = [
    ...Object.entries(parties).map(([r, id]): [string, string] => [`parties.${r}`, id!]),
    ...Object.entries(users).map(([n, id]): [string, string] => [`users.${n}`, id]),
  ];
  for (const [slot, id] of slots) {
    const other = seen.get(id);
    if (other) errors.push(`${slot}: the same party as ${other}`);
    else seen.set(id, slot);
  }

  return { file: { network: "devnet", createdAtMs: o.nowMs ?? Date.now(), parties, users }, errors, warnings };
}

/** Every party of the file with the slot it fills, in file order: what the per-party checks walk. */
export function partySlots(file: PartiesFile): Array<{ slot: string; party: string }> {
  return [
    ...Object.entries(file.parties).map(([r, party]) => ({ slot: r, party: party! })),
    ...Object.entries(file.users ?? {}).map(([n, party]) => ({ slot: n, party })),
  ];
}

/** A party id as logs and acceptance rows may show it: the hint only, never the fingerprint (ids stay out of Git). */
export const shortParty = (id: string) => `${id.slice(0, id.indexOf("::"))}::…`;
