/**
 * The projector's rows: the venue party's view of the ledger, mirrored into Postgres (plan "Venue operations and the
 * projector"; research 04-review §C5). Owned by C3a.
 *
 * Everything here is derived from `/v2/updates` and rebuildable: truncate and replay from offset 0 (or from the ACS
 * bootstrap offset on a pruned participant, recorded in `idx_cursor.history_from_offset`). Canton updates are final and
 * totally ordered per participant, so the Solana-era commitment column, finality promotion, dropped-transaction deletion
 * and `(market, seq)` gap backfill are gone. Offsets are BIGINT (int64 on the wire); the column is `ledger_offset`
 * because `offset` is a reserved word in SQL.
 *
 * Amounts are exact integers (NUMERIC), never floats. `*_base` is venue cash units as the ledger moved them;
 * `*_ticklots` is lots × price ticks, which becomes base units × the Series `cash_unit`.
 *
 * Privacy (privacy-thesis.md §4–5): these rows are the venue's own view as counterparty. Per-user rows are served only to
 * that user's seat; leaderboards, activity and sentiment read `idx_publications` (opt-in) only; market aggregates are
 * shown only with at least k = 5 participants; unaccepted quote rows are deleted when they expire or are withdrawn and
 * only per-market counters survive.
 */

/**
 * Earlier shapes cannot be altered in place, so they are dropped once and the projection replays: the Solana-era tables
 * (a `program` cursor), and a first Canton cut without the Resolution disclosure columns (whose market ids predate the
 * canonical `marketIdFromDaml`). Everything here is rebuildable from the ledger.
 */
const DROP_SOLANA_SHAPE = `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'idx_cursor' AND column_name = 'program')
     OR (EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'idx_markets')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'idx_markets' AND column_name = 'resolution_blob')) THEN
    DROP VIEW IF EXISTS idx_market_prints;
    DROP TABLE IF EXISTS idx_candles, idx_positions, idx_fills, idx_orders, idx_prints, idx_markets, idx_series, idx_events, idx_txs, idx_cursor,
      idx_updates, idx_quotes, idx_legs, idx_publications, idx_receipts, idx_event_attestations CASCADE;
  END IF;
END $$;
`;

export const INDEX_SCHEMA_SQL = `${DROP_SOLANA_SHAPE}
-- One row per stream (the venue party's view). Advances in the same transaction as the rows it covers.
CREATE TABLE IF NOT EXISTS idx_cursor (
  stream               TEXT    PRIMARY KEY,
  party                TEXT    NOT NULL,
  ledger_offset        BIGINT  NOT NULL,
  -- The last transaction applied; a checkpoint advances the offset and keeps this.
  update_id            TEXT,
  updated_at_ms        BIGINT  NOT NULL,
  -- 'replay' (from offset 0) or 'acs' (pruned participant: history before history_from_offset is not indexed).
  bootstrap            TEXT    NOT NULL DEFAULT 'replay' CHECK (bootstrap IN ('replay', 'acs')),
  history_from_offset  BIGINT  NOT NULL DEFAULT 0,
  record_time_ms       BIGINT
);

CREATE TABLE IF NOT EXISTS idx_updates (
  update_id        TEXT     PRIMARY KEY,
  ledger_offset    BIGINT   NOT NULL UNIQUE,
  record_time_ms   BIGINT,
  effective_at_ms  BIGINT   NOT NULL,
  command_id       TEXT,
  workflow_id      TEXT,
  events           INTEGER  NOT NULL,
  indexed_at_ms    BIGINT   NOT NULL
);

-- Every event the venue witnessed, raw (JSON-safe as the API sent it), keyed by its node in the update.
CREATE TABLE IF NOT EXISTS idx_events (
  update_id         TEXT     NOT NULL REFERENCES idx_updates (update_id) ON DELETE CASCADE,
  node_id           INTEGER  NOT NULL,
  ledger_offset     BIGINT   NOT NULL,
  kind              TEXT     NOT NULL CHECK (kind IN ('created', 'exercised', 'archived')),
  -- 'Module:Entity' (package id stripped); package_name says whose.
  template          TEXT     NOT NULL,
  package_name      TEXT,
  contract_id       TEXT     NOT NULL,
  choice            TEXT,
  consuming         BOOLEAN,
  last_descendant   INTEGER,
  market            TEXT,
  effective_at_sec  BIGINT   NOT NULL,
  data              JSONB    NOT NULL,
  PRIMARY KEY (update_id, node_id)
);
CREATE INDEX IF NOT EXISTS idx_events_template_idx ON idx_events (template, ledger_offset DESC);
CREATE INDEX IF NOT EXISTS idx_events_market_idx ON idx_events (market, ledger_offset) WHERE market IS NOT NULL;

-- One row per cadence lane. The roller consumes the Series every window; the newest contract wins.
CREATE TABLE IF NOT EXISTS idx_series (
  series             TEXT     PRIMARY KEY,
  series_key         TEXT     NOT NULL UNIQUE,
  symbol             TEXT,
  cadence_sec        INTEGER  NOT NULL,
  basis              SMALLINT NOT NULL DEFAULT 0,
  cash_unit          NUMERIC  NOT NULL,
  lot_base           NUMERIC  GENERATED ALWAYS AS (cash_unit * 1000) STORED,
  tick_base          NUMERIC  GENERATED ALWAYS AS (cash_unit) STORED,
  contract_id        TEXT     NOT NULL,
  next_index         BIGINT   NOT NULL,
  anchor_sec         BIGINT   NOT NULL,
  lock_lead_sec      INTEGER  NOT NULL,
  settle_grace_sec   INTEGER  NOT NULL,
  quorum             SMALLINT NOT NULL,
  oracles            JSONB    NOT NULL,
  max_deviation_bps  INTEGER  NOT NULL,
  resolver           TEXT     NOT NULL,
  policy_versions    JSONB    NOT NULL,
  updated_offset     BIGINT   NOT NULL
);

-- One row per Window: MarketTerms created by Series_OpenWindow. market = marketIdFromDaml(marketId), the app's MarketId.
CREATE TABLE IF NOT EXISTS idx_markets (
  market                TEXT     PRIMARY KEY,
  market_key            TEXT     NOT NULL UNIQUE,
  terms_cid             TEXT     NOT NULL UNIQUE,
  series                TEXT,
  series_key            TEXT     NOT NULL,
  symbol                TEXT,
  cadence_sec           INTEGER,
  basis                 SMALLINT NOT NULL DEFAULT 0,
  market_index          BIGINT   NOT NULL,
  cash_unit             NUMERIC  NOT NULL,
  trading_start_sec     BIGINT   NOT NULL,
  lock_at_sec           BIGINT   NOT NULL,
  expiry_sec            BIGINT   NOT NULL,
  open_deadline_sec     BIGINT   NOT NULL,
  close_deadline_sec    BIGINT   NOT NULL,
  refund_after_sec      BIGINT   NOT NULL,
  policy_version        SMALLINT NOT NULL,
  print_source          TEXT,
  min_delay_sec         INTEGER,
  bar_len_sec           INTEGER,
  tie_up                BOOLEAN,
  quorum                SMALLINT NOT NULL,
  oracles               JSONB    NOT NULL,
  max_deviation_bps     INTEGER  NOT NULL,
  resolver              TEXT     NOT NULL,
  opened_update_id      TEXT     NOT NULL,
  opened_offset         BIGINT   NOT NULL,
  opened_ts_sec         BIGINT   NOT NULL,
  window_state_cid      TEXT,
  open_print_cid        TEXT,
  open_price_e8         NUMERIC,
  open_signers          SMALLINT,
  open_evidence         JSONB,
  open_recorded_ts_sec  BIGINT,
  open_update_id        TEXT,
  state                 TEXT     NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'resolved', 'voided')),
  -- 0 Yes (Up), 1 No (Down), 2 Void.
  winner                SMALLINT,
  -- The reference's two values: 1 missing print (MissingPrint, QuorumNotMet, ResolverAbsent), 2 source disagreement.
  void_reason           SMALLINT,
  void_detail           TEXT,
  close_price_e8        NUMERIC,
  close_signers         SMALLINT,
  close_evidence        JSONB,
  signers               SMALLINT,
  single_source         BOOLEAN,
  resolution_cid        TEXT     UNIQUE,
  resolved_ts_sec       BIGINT,
  resolved_update_id    TEXT,
  resolved_at_ms        BIGINT,
  -- What Leg_Claim needs to receive the Resolution as a disclosed contract (the seat is not its stakeholder).
  resolution_blob         TEXT,
  resolution_template_id  TEXT,
  synchronizer_id         TEXT,
  -- Market-level aggregates: served only while participants >= 5 (k-anonymity floor).
  participants          INTEGER  NOT NULL DEFAULT 0,
  backing_lots          NUMERIC  NOT NULL DEFAULT 0,
  volume_lots           NUMERIC  NOT NULL DEFAULT 0,
  volume_ticklots       NUMERIC  NOT NULL DEFAULT 0,
  trade_count           BIGINT   NOT NULL DEFAULT 0,
  last_price_ticks      SMALLINT,
  last_trade_sec        BIGINT,
  quotes_issued         INTEGER  NOT NULL DEFAULT 0,
  quotes_accepted       INTEGER  NOT NULL DEFAULT 0,
  quotes_expired        INTEGER  NOT NULL DEFAULT 0,
  quotes_withdrawn      INTEGER  NOT NULL DEFAULT 0,
  legs_open             INTEGER  NOT NULL DEFAULT 0,
  legs_settled          INTEGER  NOT NULL DEFAULT 0,
  legs_claimed          INTEGER  NOT NULL DEFAULT 0,
  legs_refunded_stale   INTEGER  NOT NULL DEFAULT 0,
  legs_sold             INTEGER  NOT NULL DEFAULT 0,
  legs_closed_out       INTEGER  NOT NULL DEFAULT 0,
  legs_merged           INTEGER  NOT NULL DEFAULT 0,
  fees_recognized_base  NUMERIC  NOT NULL DEFAULT 0,
  payouts_base          NUMERIC  NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_markets_series_idx ON idx_markets (series, market_index DESC);
CREATE INDEX IF NOT EXISTS idx_markets_expiry_idx ON idx_markets (expiry_sec DESC);

-- Oracle prints: one PriceQuote per (oracle, symbol, boundary). A second post by the same oracle keeps the earliest
-- fetch (then the lowest price), the rule the Daml's collectEvidence applies; 'duplicates' counts the others.
CREATE TABLE IF NOT EXISTS idx_prints (
  oracle           TEXT     NOT NULL,
  symbol           TEXT     NOT NULL,
  boundary_sec     BIGINT   NOT NULL,
  contract_id      TEXT     NOT NULL,
  price_e8         NUMERIC  NOT NULL,
  bar_start_sec    BIGINT   NOT NULL,
  bar_len_sec      INTEGER  NOT NULL,
  fetched_at_sec   BIGINT   NOT NULL,
  payload_hash     TEXT     NOT NULL,
  policy_version   SMALLINT NOT NULL,
  recorded_ts_sec  BIGINT   NOT NULL,
  update_id        TEXT     NOT NULL,
  retired          BOOLEAN  NOT NULL DEFAULT false,
  duplicates       INTEGER  NOT NULL DEFAULT 0,
  PRIMARY KEY (oracle, symbol, boundary_sec)
);
CREATE INDEX IF NOT EXISTS idx_prints_symbol_idx ON idx_prints (symbol, boundary_sec);
CREATE INDEX IF NOT EXISTS idx_prints_cid_idx ON idx_prints (contract_id);

-- Venue quotes to one user. Only live and accepted quotes keep a row: an expired or withdrawn quote is a record of
-- intent the ledger no longer holds, so its row is deleted and only idx_markets.quotes_* counts it.
CREATE TABLE IF NOT EXISTS idx_quotes (
  quote_cid         TEXT     PRIMARY KEY,
  kind              TEXT     NOT NULL CHECK (kind IN ('quote', 'buy')),
  market            TEXT     NOT NULL,
  terms_cid         TEXT     NOT NULL,
  user_party        TEXT     NOT NULL,
  user_address      TEXT,
  pair_id           TEXT     NOT NULL,
  -- The user's side: 0 Up, 1 Down; price_ticks is that side's price.
  side              SMALLINT NOT NULL,
  price_ticks       SMALLINT NOT NULL,
  lots              NUMERIC  NOT NULL,
  cash_unit         NUMERIC  NOT NULL,
  fee               NUMERIC  NOT NULL DEFAULT 0,
  leg_cid           TEXT,
  valid_until_sec   BIGINT   NOT NULL,
  issued_update_id  TEXT     NOT NULL,
  issued_offset     BIGINT   NOT NULL,
  issued_ts_sec     BIGINT   NOT NULL,
  status            TEXT     NOT NULL CHECK (status IN ('issued', 'accepted', 'expired', 'withdrawn')),
  closed_update_id  TEXT,
  closed_ts_sec     BIGINT
);
CREATE INDEX IF NOT EXISTS idx_quotes_user_idx ON idx_quotes (user_party, issued_ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_address_idx ON idx_quotes (user_address, issued_ts_sec DESC) WHERE user_address IS NOT NULL;

-- Every Leg the venue is party to (users' and the venue's own), with how it ended.
CREATE TABLE IF NOT EXISTS idx_legs (
  leg_cid              TEXT     PRIMARY KEY,
  market               TEXT     NOT NULL,
  terms_cid            TEXT     NOT NULL,
  owner_party          TEXT     NOT NULL,
  owner_address        TEXT,
  is_venue             BOOLEAN  NOT NULL,
  pair_id              TEXT     NOT NULL,
  outcome              SMALLINT NOT NULL,
  lots                 NUMERIC  NOT NULL,
  cash_unit            NUMERIC  NOT NULL,
  backing_share        NUMERIC  NOT NULL,
  fee_paid             NUMERIC  NOT NULL,
  refund_after_sec     BIGINT   NOT NULL,
  origin               TEXT     NOT NULL CHECK (origin IN ('accept', 'buyback', 'closeout', 'snapshot', 'other')),
  created_update_id    TEXT     NOT NULL,
  created_offset       BIGINT   NOT NULL,
  created_ts_sec       BIGINT   NOT NULL,
  status               TEXT     NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'claimed', 'refunded_stale', 'sold', 'closed_out', 'merged', 'archived')),
  result               TEXT     CHECK (result IN ('won', 'lost', 'void')),
  payout_base          NUMERIC,
  fee_recognized_base  NUMERIC,
  closed_update_id     TEXT,
  closed_offset        BIGINT,
  closed_ts_sec        BIGINT
);
CREATE INDEX IF NOT EXISTS idx_legs_owner_idx ON idx_legs (owner_party, created_ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_legs_market_idx ON idx_legs (market, status);

-- One row per trade: a user Leg created by Quote_Accept (path 2 MINT: the pair is minted), or a user leg sold back by
-- BuyQuote_Accept (path 0/1 DIRECT). Keyed by the accept's exercise node. price_ticks is YES (Up) terms.
CREATE TABLE IF NOT EXISTS idx_fills (
  update_id      TEXT     NOT NULL,
  node_id        INTEGER  NOT NULL,
  ledger_offset  BIGINT   NOT NULL,
  market         TEXT     NOT NULL,
  terms_cid      TEXT     NOT NULL,
  quote_cid      TEXT     NOT NULL,
  leg_cid        TEXT     NOT NULL,
  pair_id        TEXT     NOT NULL,
  owner_party    TEXT     NOT NULL,
  owner_address  TEXT,
  venue_party    TEXT     NOT NULL,
  -- The user's side 0 Up, 1 Down; kind 0 BUY_YES, 1 SELL_YES, 2 BUY_NO, 3 SELL_NO; path 0 DIRECT_YES, 1 DIRECT_NO, 2 MINT_PAIR.
  side           SMALLINT NOT NULL,
  kind           SMALLINT NOT NULL,
  path           SMALLINT NOT NULL,
  price_ticks    SMALLINT NOT NULL,
  side_ticks     SMALLINT NOT NULL,
  lots           NUMERIC  NOT NULL,
  fee            NUMERIC  NOT NULL,
  cash_unit      NUMERIC  NOT NULL,
  ts_sec         BIGINT   NOT NULL,
  PRIMARY KEY (update_id, node_id)
);
CREATE INDEX IF NOT EXISTS idx_fills_market_idx ON idx_fills (market, ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_fills_owner_idx ON idx_fills (owner_party, ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_fills_address_idx ON idx_fills (owner_address, ts_sec DESC) WHERE owner_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fills_ts_idx ON idx_fills (ts_sec DESC);

-- What each user holds and moved in one Window. The venue's own legs are not positions.
CREATE TABLE IF NOT EXISTS idx_positions (
  market             TEXT    NOT NULL,
  owner_party        TEXT    NOT NULL,
  owner_address      TEXT,
  yes_lots           NUMERIC NOT NULL DEFAULT 0,
  no_lots            NUMERIC NOT NULL DEFAULT 0,
  bought_yes_lots    NUMERIC NOT NULL DEFAULT 0,
  sold_yes_lots      NUMERIC NOT NULL DEFAULT 0,
  bought_no_lots     NUMERIC NOT NULL DEFAULT 0,
  sold_no_lots       NUMERIC NOT NULL DEFAULT 0,
  paid_ticklots      NUMERIC NOT NULL DEFAULT 0,
  received_ticklots  NUMERIC NOT NULL DEFAULT 0,
  fees_paid_base     NUMERIC NOT NULL DEFAULT 0,
  payout_base        NUMERIC NOT NULL DEFAULT 0,
  refunded_base      NUMERIC NOT NULL DEFAULT 0,
  open_legs          INTEGER NOT NULL DEFAULT 0,
  -- Every leg ended (settled, claimed, refunded, sold or closed out).
  redeemed           BOOLEAN NOT NULL DEFAULT false,
  -- The venue's Leg_Settle paid it (the reference's crank), not the owner's Leg_Claim.
  redeemed_by_crank  BOOLEAN NOT NULL DEFAULT false,
  refunded_stale     BOOLEAN NOT NULL DEFAULT false,
  closed_out         BOOLEAN NOT NULL DEFAULT false,
  fills              INTEGER NOT NULL DEFAULT 0,
  first_ts_sec       BIGINT,
  last_ts_sec        BIGINT,
  entry_update_id    TEXT,
  last_update_id     TEXT,
  PRIMARY KEY (market, owner_party)
);
CREATE INDEX IF NOT EXISTS idx_positions_owner_idx ON idx_positions (owner_party, last_ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_positions_address_idx ON idx_positions (owner_address, last_ts_sec DESC) WHERE owner_address IS NOT NULL;

-- 1-minute candles per Window from fills, YES-terms ticks. Served only above the k = 5 floor.
CREATE TABLE IF NOT EXISTS idx_candles (
  market        TEXT     NOT NULL,
  bucket_sec    BIGINT   NOT NULL,
  open_ticks    SMALLINT NOT NULL,
  high_ticks    SMALLINT NOT NULL,
  low_ticks     SMALLINT NOT NULL,
  close_ticks   SMALLINT NOT NULL,
  volume_lots   NUMERIC  NOT NULL,
  trades        INTEGER  NOT NULL,
  PRIMARY KEY (market, bucket_sec)
);

-- Opt-in publications (PM.Publication, created by Leg_Publish). The only source of leaderboards, activity and
-- sentiment. A retraction deletes the row, so it drops out of every later read.
CREATE TABLE IF NOT EXISTS idx_publications (
  publication_cid    TEXT     PRIMARY KEY,
  owner_party        TEXT     NOT NULL,
  owner_address      TEXT,
  handle             TEXT     NOT NULL,
  market             TEXT     NOT NULL,
  market_key         TEXT     NOT NULL,
  pair_id            TEXT     NOT NULL,
  outcome            SMALLINT NOT NULL,
  lots               NUMERIC  NOT NULL,
  backing_share      NUMERIC  NOT NULL,
  -- The owner's side price, from the ledger's own figures: backing_share / (lots × cash_unit); null before the Window is known.
  price_ticks        SMALLINT,
  created_update_id  TEXT     NOT NULL,
  created_offset     BIGINT   NOT NULL,
  created_ts_sec     BIGINT   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_publications_ts_idx ON idx_publications (created_ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_publications_owner_idx ON idx_publications (owner_party, created_ts_sec DESC);
CREATE INDEX IF NOT EXISTS idx_publications_market_idx ON idx_publications (market);

-- 0.4.0 (C6d): a Publication names its ticket product (NULL = a pair leg).
ALTER TABLE idx_publications ADD COLUMN IF NOT EXISTS product TEXT;

-- 0.4.0 (C6d): committee events. A Window listed by Series_OpenEvent carries its EventTerms (the question, never
-- archived), its single-use EventState (cleared when Event_Resolve / Event_Void consumes it) and, once decided, the
-- EventVerdict (the answer, or NULL with the void reason, and every attestation counted).
ALTER TABLE idx_markets ADD COLUMN IF NOT EXISTS event_terms_cid TEXT;
ALTER TABLE idx_markets ADD COLUMN IF NOT EXISTS event_question TEXT;
ALTER TABLE idx_markets ADD COLUMN IF NOT EXISTS event_attestors JSONB;
ALTER TABLE idx_markets ADD COLUMN IF NOT EXISTS event_quorum SMALLINT;
ALTER TABLE idx_markets ADD COLUMN IF NOT EXISTS event_state_cid TEXT;
ALTER TABLE idx_markets ADD COLUMN IF NOT EXISTS event_verdict_cid TEXT;
ALTER TABLE idx_markets ADD COLUMN IF NOT EXISTS event_answer BOOLEAN;
ALTER TABLE idx_markets ADD COLUMN IF NOT EXISTS event_verdict JSONB;

-- One committee member's answer (PM.Event.EventAttestation), signed by the member; the venue is an observer.
CREATE TABLE IF NOT EXISTS idx_event_attestations (
  contract_id      TEXT     PRIMARY KEY,
  market_key       TEXT     NOT NULL,
  attestor         TEXT     NOT NULL,
  answer           BOOLEAN  NOT NULL,
  attested_at_sec  BIGINT   NOT NULL,
  statement_hash   TEXT     NOT NULL,
  retired          BOOLEAN  NOT NULL DEFAULT false,
  created_update_id TEXT    NOT NULL,
  created_offset   BIGINT   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_event_attestations_market_idx ON idx_event_attestations (market_key);

-- 0.4.0 (C6d, K-028/K-030): the ledger's settlement record of one position, pair leg or ticket (PM.Publication.
-- SettlementReceipt, bilateral owner + venue). Portfolio history reads it; Receipt_Dismiss marks it dismissed.
CREATE TABLE IF NOT EXISTS idx_receipts (
  receipt_cid        TEXT     PRIMARY KEY,
  owner_party        TEXT     NOT NULL,
  owner_address      TEXT,
  market             TEXT     NOT NULL,
  market_key         TEXT     NOT NULL,
  pair_id            TEXT     NOT NULL,
  outcome            SMALLINT NOT NULL,
  -- 0 Up, 1 Down, NULL void.
  resolved           SMALLINT,
  lots               NUMERIC  NOT NULL,
  cash_unit          NUMERIC  NOT NULL,
  backing_share      NUMERIC  NOT NULL,
  cost               NUMERIC  NOT NULL,
  payout             NUMERIC  NOT NULL,
  fee                NUMERIC  NOT NULL,
  -- NULL = a pair leg; range, moonshot, boost, short, parlay.
  product            TEXT,
  detail             JSONB,
  dismissed          BOOLEAN  NOT NULL DEFAULT false,
  created_update_id  TEXT     NOT NULL,
  created_offset     BIGINT   NOT NULL,
  created_ts_sec     BIGINT   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_receipts_owner_idx ON idx_receipts (owner_party, created_offset DESC);

-- The reference's per-Window print slots (which 0 open, 1 close) over the recorded quorum medians; source 4 = attested.
CREATE OR REPLACE VIEW idx_market_prints AS
  SELECT market, 0::smallint AS which, 4::smallint AS source, open_price_e8 AS price, -8 AS expo, trading_start_sec AS source_ts_sec,
    open_signers AS signers, false AS copied, open_recorded_ts_sec AS recorded_ts_sec, open_update_id AS signature
  FROM idx_markets WHERE open_price_e8 IS NOT NULL
  UNION ALL
  SELECT market, 1::smallint, 4::smallint, close_price_e8, -8, expiry_sec, close_signers, false, resolved_ts_sec, resolved_update_id
  FROM idx_markets WHERE close_price_e8 IS NOT NULL;
`;

/** Every projection table, in the order a full rebuild truncates them (the view reads idx_markets and survives). */
export const INDEX_TABLES = [
  "idx_receipts",
  "idx_event_attestations",
  "idx_publications",
  "idx_candles",
  "idx_positions",
  "idx_fills",
  "idx_legs",
  "idx_quotes",
  "idx_prints",
  "idx_markets",
  "idx_series",
  "idx_events",
  "idx_updates",
  "idx_cursor",
] as const;

/** k-anonymity floor for market-level aggregates (privacy-thesis.md §5). */
export const K_ANON_FLOOR = 5;
