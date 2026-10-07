/**
 * The DevNet checks the bootstrap and the preflight share (C2y). On the shared Noders participant nothing is ever
 * enumerated: no unfiltered `GET /v2/parties`, no `GET /v2/users`. What we read is our own user
 * (`/v2/authenticated-user`, its `/rights`), each of OUR parties by id (`/v2/parties/{party}`), and the package ids
 * (`/v2/packages`: packages, not parties).
 */
import { readFileSync } from "node:fs";
import { LedgerError, type LedgerClient } from "@owarine/ledger";
import type { PartiesFile } from "../../services/ops/src/runtime/keys";
import { darMain, type RepoDar } from "./dar";
import { partySlots, shortParty } from "./devnet-parties";
import { errorEvidence, type CheckRow } from "./rows";

export interface AuthenticatedUser {
  id: string;
  primaryParty?: string;
}

export async function authenticatedUser(client: LedgerClient): Promise<AuthenticatedUser> {
  const r = await client.http.request<{ user?: { id?: string; primaryParty?: string } }>("GET", "/v2/authenticated-user");
  if (!r.user?.id) throw new Error("/v2/authenticated-user returned no user id");
  return { id: r.user.id, ...(r.user.primaryParty ? { primaryParty: r.user.primaryParty } : {}) };
}

export interface UserRights {
  actAs: Set<string>;
  readAs: Set<string>;
  participantAdmin: boolean;
  /** Any other right kinds, by name (`CanReadAsAnyParty`, `IdentityProviderAdmin`, …). */
  other: string[];
}

type RightJson = { kind?: Record<string, { value?: { party?: string } }> };

export async function userRights(client: LedgerClient, userId: string): Promise<UserRights> {
  const r = await client.http.request<{ rights?: RightJson[] }>("GET", `/v2/users/${encodeURIComponent(userId)}/rights`);
  const out: UserRights = { actAs: new Set(), readAs: new Set(), participantAdmin: false, other: [] };
  for (const right of r.rights ?? []) {
    for (const [kind, v] of Object.entries(right.kind ?? {})) {
      if (kind === "CanActAs" && v.value?.party) out.actAs.add(v.value.party);
      else if (kind === "CanReadAs" && v.value?.party) out.readAs.add(v.value.party);
      else if (kind === "ParticipantAdmin") out.participantAdmin = true;
      else out.other.push(kind);
    }
  }
  return out;
}

/**
 * Every party of the file, one filtered call each, plus our user's act-as rights over it.
 *   - `rightsOf`: the user whose rights to check (password mode: `/v2/authenticated-user`); undefined on a local
 *     unauthenticated sandbox, where rights do not apply and only the party lookups run.
 * A 403 on a party lookup is a note, not a failure: the node may reserve party details for admins, and act-as is what
 * the bootstrap needs.
 */
export async function verifyParties(client: LedgerClient, file: PartiesFile, o: { rightsOf?: string } = {}): Promise<CheckRow[]> {
  const rows: CheckRow[] = [];
  let rights: UserRights | undefined;
  if (o.rightsOf !== undefined) {
    try {
      rights = await userRights(client, o.rightsOf);
      rows.push({ check: "ledger user rights", outcome: "pass", detail: `act-as over ${rights.actAs.size} parties, read-as over ${rights.readAs.size}${rights.participantAdmin ? ", participant admin" : ""}`, evidence: "GET /v2/users/{own id}/rights" });
    } catch (e) {
      const ev = errorEvidence(e);
      rows.push({ check: "ledger user rights", outcome: "fail", detail: ev.detail, evidence: ev.evidence });
    }
  }
  for (const { slot, party } of partySlots(file)) {
    const who = `${slot} (${shortParty(party)})`;
    let lookup: CheckRow;
    try {
      const r = await client.http.request<{ partyDetails?: Array<{ party: string; isLocal?: boolean }> }>("GET", `/v2/parties/${encodeURIComponent(party)}`);
      const d = (r.partyDetails ?? []).find((p) => p.party === party);
      lookup = !d
        ? { check: `party ${who}`, outcome: "fail", detail: "not known to this participant (check the id copied from the Console)", evidence: "GET /v2/parties/{party}" }
        : d.isLocal === false
          ? { check: `party ${who}`, outcome: "fail", detail: "known but not hosted here (isLocal false)", evidence: "GET /v2/parties/{party}" }
          : { check: `party ${who}`, outcome: "pass", detail: "hosted on this participant", evidence: "GET /v2/parties/{party}" };
    } catch (e) {
      const ev = errorEvidence(e);
      const forbidden = e instanceof LedgerError && (e.status === 403 || e.kind === "permission");
      const notFound = e instanceof LedgerError && (e.status === 404 || e.kind === "not-found");
      lookup = forbidden && rights
        ? { check: `party ${who}`, outcome: "warn", detail: "party details are admin-only here; act-as below is the proof", evidence: ev.evidence }
        : { check: `party ${who}`, outcome: "fail", detail: notFound ? "not known to this participant" : ev.detail, evidence: ev.evidence };
    }
    if (rights) {
      if (!rights.actAs.has(party)) {
        lookup = { check: `party ${who}`, outcome: "fail", detail: `the ledger user cannot act as it${rights.readAs.has(party) ? " (read-as only)" : ""}: Console → Parties → Assign can-act-as`, evidence: lookup.evidence ?? "GET /v2/users/{own id}/rights" };
      } else if (lookup.outcome === "pass") {
        lookup = { ...lookup, detail: `${lookup.detail}, act-as granted` };
      }
    }
    rows.push(lookup);
  }
  return rows;
}

/**
 * Each of our DARs' main package must be on the participant: `GET /v2/packages` lists ids (all teams' packages, but
 * package ids only), and `/v2/packages/{id}/status` says whether it is registered. A missing DAR file or a missing id
 * is a failure: the bootstrap would otherwise run against another build.
 */
export async function verifyPackages(client: LedgerClient, dars: readonly RepoDar[]): Promise<CheckRow[]> {
  const rows: CheckRow[] = [];
  let ids: Set<string>;
  try {
    const r = await client.http.request<{ packageIds?: string[] }>("GET", "/v2/packages");
    ids = new Set(r.packageIds ?? []);
  } catch (e) {
    const ev = errorEvidence(e);
    return [{ check: "package list", outcome: "fail", detail: ev.detail, evidence: ev.evidence }];
  }
  for (const dar of dars) {
    const label = `package ${dar.name} ${dar.version}`;
    if (!dar.path) {
      rows.push({ check: label, outcome: "fail", detail: `no built DAR (daml/released/${dar.name}-${dar.version}.dar or its .daml/dist): run \`dpm build --all\`` });
      continue;
    }
    let main;
    try {
      main = darMain(readFileSync(dar.path));
    } catch (e) {
      rows.push({ check: label, outcome: "fail", detail: `unreadable DAR: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    if (main.name !== dar.name || main.version !== dar.version) {
      rows.push({ check: label, outcome: "fail", detail: `the DAR file holds ${main.name} ${main.version}` });
      continue;
    }
    const short = main.packageId.slice(0, 12);
    if (!ids.has(main.packageId)) {
      rows.push({ check: label, outcome: "fail", detail: `id ${short}… not on the participant: not uploaded yet, or a different build was uploaded`, evidence: "GET /v2/packages" });
      continue;
    }
    try {
      const s = await client.http.request<{ packageStatus?: string }>("GET", `/v2/packages/${main.packageId}/status`);
      const registered = s.packageStatus === "PACKAGE_STATUS_REGISTERED";
      rows.push({ check: label, outcome: registered ? "pass" : "fail", detail: `id ${short}… ${s.packageStatus ?? "no status"}`, evidence: `GET /v2/packages/${short}…/status` });
    } catch (e) {
      const ev = errorEvidence(e);
      rows.push({ check: label, outcome: "warn", detail: `id ${short}… listed; status unreadable (${ev.detail})`, evidence: ev.evidence });
    }
  }
  return rows;
}
