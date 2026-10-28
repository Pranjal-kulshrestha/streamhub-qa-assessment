-- Schema for both SQL scenarios. Written to run on SQLite (used for the screenshots).
-- MySQL 8 / PostgreSQL need no schema change except TIMESTAMP/DATETIME naming (see dialects.md).

-- Scenario 1: account-to-account transfers
CREATE TABLE transactions (
  txn_id        INTEGER      PRIMARY KEY,
  from_account  VARCHAR(20)  NOT NULL,
  to_account    VARCHAR(20)  NOT NULL,
  amount        DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  txn_time      TIMESTAMP    NOT NULL,
  CHECK (from_account <> to_account)
);
CREATE INDEX idx_txn_pair ON transactions (from_account, to_account, txn_time);

-- Scenario 2: IPL style per-player, per-match batting scores
CREATE TABLE player_match_stats (
  player_id    INTEGER      NOT NULL,
  player_name  VARCHAR(100) NOT NULL,
  team         VARCHAR(50)  NOT NULL,
  match_id     INTEGER      NOT NULL,
  match_date   DATE         NOT NULL,
  runs         INTEGER      NOT NULL CHECK (runs >= 0),
  PRIMARY KEY (player_id, match_id)
);
CREATE INDEX idx_stats_player_date ON player_match_stats (player_id, match_date);
