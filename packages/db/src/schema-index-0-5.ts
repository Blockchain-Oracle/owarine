import { INDEX_SCHEMA_0_4_SQL } from "./schema-index-0-4";

/**
 * Engine 0.5.1 (C7c, K-235) additions to the projection: the pre-open resting call. Added in place
 * (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), so an existing projection picks them up; calls created
 * before the upgrade appear after a rebuild (replay from offset 0).
 */
const INDEX_SCHEMA_0_5_SQL = `
-- One row per resting call (PM.Resting.RestingCall), keyed by its stable reference: a partial fill re-creates the call, so
-- its contract id changes (call_cid follows it) while call_ref does not. A row is kept when the call ends: filled,
-- cancelled by its owner, or expired unfilled (the stake came back as venue credit), so the portfolio can say how each ended.
-- Per-user like idx_quotes and idx_legs: served only to the owner's seat, never aggregated.
CREATE TABLE IF NOT EXISTS idx_resting (
  call_ref           TEXT     PRIMARY KEY,
  call_cid           TEXT     NOT NULL,
  market             TEXT     NOT NULL,
  terms_cid          TEXT     NOT NULL,
  user_party         TEXT     NOT NULL,
  user_address       TEXT,
  -- The owner's side: 0 Up, 1 Down; price_ticks is that side's own price (an UP call at 55c is 550, DOWN at 55c is 550).
  side               SMALLINT NOT NULL,
  price_ticks        SMALLINT NOT NULL,
  cash_unit          NUMERIC  NOT NULL,
  lots_placed        NUMERIC  NOT NULL,
  lots_remaining     NUMERIC  NOT NULL,
  -- What the call still holds (0 once it has ended).
  escrow_base        NUMERIC  NOT NULL,
  trading_start_sec  BIGINT   NOT NULL,
  expires_at_sec     BIGINT   NOT NULL,
  placed_update_id   TEXT     NOT NULL,
  placed_offset      BIGINT   NOT NULL,
  placed_ts_sec      BIGINT   NOT NULL,
  status             TEXT     NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled', 'expired')),
  -- What came back as venue credit when the call was cancelled or expired.
  refunded_base      NUMERIC  NOT NULL DEFAULT 0,
  closed_update_id   TEXT,
  closed_ts_sec      BIGINT
);
CREATE INDEX IF NOT EXISTS idx_resting_user_idx ON idx_resting (user_party, placed_ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_resting_cid_idx ON idx_resting (call_cid);
CREATE INDEX IF NOT EXISTS idx_resting_market_idx ON idx_resting (market, status);

-- A fill that came from a resting call, not from a firm quote: the seat's own activity reads it as "your resting call filled".
ALTER TABLE idx_fills ADD COLUMN IF NOT EXISTS resting BOOLEAN NOT NULL DEFAULT false;

-- C8d (L-39): the user's own tag on a leg (\`beneficiaryRef\`): \`private\` marks a private call, read only by its own seat.
ALTER TABLE idx_legs ADD COLUMN IF NOT EXISTS beneficiary_ref TEXT;

-- C8d (C-DAML-03): the products that pin a Window's terms (abu-pm-tickets 0.1.3: RangeRound, each undecided leg of a
-- ParlayTicket, BoostPosition), one row per (product contract, terms). Open while closed_ts_sec is null. Settlement and
-- quote retention read the open count here, in the projection, never on the ledger (plan "Products and programs").
-- Venue-wide counts only; the owner column never leaves the projection.
CREATE TABLE IF NOT EXISTS idx_dependents (
  product_cid        TEXT     NOT NULL,
  terms_cid          TEXT     NOT NULL,
  market_key         TEXT     NOT NULL,
  product            TEXT     NOT NULL CHECK (product IN ('range', 'moonshot', 'parlay', 'boost', 'short')),
  owner_party        TEXT     NOT NULL,
  opened_update_id   TEXT     NOT NULL,
  opened_offset      BIGINT   NOT NULL,
  opened_ts_sec      BIGINT   NOT NULL,
  closed_update_id   TEXT,
  closed_ts_sec      BIGINT,
  how                TEXT,
  PRIMARY KEY (product_cid, terms_cid)
);
CREATE INDEX IF NOT EXISTS idx_dependents_open_idx ON idx_dependents (terms_cid) WHERE closed_ts_sec IS NULL;

-- Engine 0.5.2 (C2e, K-315): the bucket a settlement receipt's payout landed in when it is not the public one
-- (\`SettlementReceipt.paidInto\`): \`private\` for a private call, paid straight back into the seat's private bucket.
ALTER TABLE idx_receipts ADD COLUMN IF NOT EXISTS paid_into TEXT;
`;

/** Every in-place addition to the projection since the first Canton cut: engine 0.4.0's, then 0.5.1's and 0.5.2's. */
export const INDEX_SCHEMA_ADDITIONS_SQL = `${INDEX_SCHEMA_0_4_SQL}\n${INDEX_SCHEMA_0_5_SQL}`;
