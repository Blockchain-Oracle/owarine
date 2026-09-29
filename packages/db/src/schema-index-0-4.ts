/**
 * Engine 0.4.0 (C6d) additions to the projection: committee events, settlement receipts and the publication's product.
 * Added in place (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`), so an existing projection picks them up;
 * rows for contracts created before the upgrade appear after a rebuild (replay from offset 0).
 */
export const INDEX_SCHEMA_0_4_SQL = `
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

-- C6e (K-070): idx_prints keeps every PriceQuote, keyed by contract id, with the resolution's one flagged. A projection
-- made before keeps its rows (each was the chosen one); the extra posts it dropped appear after a rebuild.
ALTER TABLE idx_prints ADD COLUMN IF NOT EXISTS chosen BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE idx_prints ADD COLUMN IF NOT EXISTS evidence BOOLEAN NOT NULL DEFAULT false;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'idx_prints'::regclass AND contype = 'p' AND array_length(conkey, 1) = 3) THEN
    ALTER TABLE idx_prints DROP CONSTRAINT idx_prints_pkey;
    ALTER TABLE idx_prints ADD PRIMARY KEY (contract_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_prints_key_idx ON idx_prints (oracle, symbol, boundary_sec);
`;
