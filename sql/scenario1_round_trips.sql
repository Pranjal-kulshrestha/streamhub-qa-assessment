-- Scenario 1: Account A sends money to Account B, and B sends a similar amount (within 10%)
-- back to A. Both transactions must fall inside a 24-hour window.
--
-- Rules used:
--   * "similar" = the returned amount differs from the original amount by at most 10% of the original.
--   * the return must happen AFTER the original and within 24 hours (inclusive).
--   * every (original, return) pair is reported, so one send with two returns gives two rows.
-- SQLite dialect (strftime('%s') = epoch seconds). MySQL and PostgreSQL versions are in sql/dialects.md.

SELECT
  t1.txn_id                         AS sent_txn,
  t2.txn_id                         AS returned_txn,
  t1.from_account                   AS account_a,
  t1.to_account                     AS account_b,
  t1.amount                         AS amount_sent,
  t2.amount                         AS amount_returned,
  ROUND(ABS(t2.amount - t1.amount) * 100.0 / t1.amount, 2) AS diff_percent,
  t1.txn_time                       AS sent_at,
  t2.txn_time                       AS returned_at,
  ROUND((strftime('%s', t2.txn_time) - strftime('%s', t1.txn_time)) / 3600.0, 2) AS hours_between
FROM transactions t1
JOIN transactions t2
  ON  t2.from_account = t1.to_account          -- B sends ...
  AND t2.to_account   = t1.from_account        -- ... back to A
  AND t2.txn_time     > t1.txn_time            -- after the original (also stops a row matching itself)
  AND (strftime('%s', t2.txn_time) - strftime('%s', t1.txn_time)) <= 86400  -- 24h in seconds (integer maths, exact at the boundary)
  AND ABS(t2.amount - t1.amount) <= 0.10 * t1.amount
ORDER BY t1.txn_time, t2.txn_time;
