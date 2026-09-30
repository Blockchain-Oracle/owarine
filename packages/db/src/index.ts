/**
 * Optional Postgres for social records only — chain truth is never stored here.
 *
 * Every export is `null`-shaped when `DATABASE_URL` is absent, so the app runs
 * correctly with no database and each surface says plainly that it is not
 * connected rather than showing an empty room that nobody has read.
 */
export const DB_PACKAGE = "@agari/db" as const;

export * from "./arcade";
export * from "./bettors";
export * from "./client";
export * from "./comments";
export * from "./decks";
export * from "./seasons";
export * from "./games";
export * from "./lucky";
export * from "./migrate";
export * from "./schema";
export * from "./takes";
export * from "./x";
export * from "./x-reply-delivery";
export * from "./x-health";
export * from "./strategies";
export * from "./strategy-memory";
export * from "./strategy-decisions";
export * from "./strategy-attempts";
export * from "./faucet";
export * from "./print-archive";
export * from "./print-archive-read";
export * from "./index-store";
export * from "./proofs";
export * from "./sponsor";
export * from "./schema-sponsor";
export * from "./follows";
// C9d: recycling a drained guest seat, shared by ops and the web.
export * from "./seat-recycle";
// C4c: the one address → party resolution for seat keys (a lease's own key, or a key joined to that live lease).
export * from "./seat-keys";
// S26.4: phone push devices and the sent journal.
export * from "./push";
// S21 (D-126): the desk's records, paper ledger, approvals and grades.
export * from "./schema-desk";
export * from "./desk";
export * from "./desk-records";
export * from "./desk-approvals";
export * from "./desk-grades";
export * from "./desk-marks";
export * from "./desk-series";
export * from "./desk-queries";
export * from "./take-tags";
export * from "./idx/social-gate";
// C4d (K-210): a draining seat's desks are closed in the index with it.
export * from "./desk-lease";
