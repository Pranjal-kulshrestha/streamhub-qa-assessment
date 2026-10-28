# SQL dialect notes

The scripts in this folder run on SQLite (that is what produced the screenshots).
Only the date arithmetic in scenario 1 changes in other databases. Scenario 2 uses
standard window functions and runs unchanged on PostgreSQL, MySQL 8+, SQL Server and SQLite 3.25+.

## Scenario 1: replace the 24 hour condition

| Database   | Condition inside the JOIN |
|------------|---------------------------|
| SQLite     | `(strftime('%s', t2.txn_time) - strftime('%s', t1.txn_time)) <= 86400` |
| PostgreSQL | `t2.txn_time <= t1.txn_time + INTERVAL '24 hours'` |
| MySQL 8    | `t2.txn_time <= t1.txn_time + INTERVAL 24 HOUR` |
| SQL Server | `t2.txn_time <= DATEADD(HOUR, 24, t1.txn_time)` |

For `hours_between` in the SELECT list:

| Database   | Expression |
|------------|------------|
| PostgreSQL | `ROUND(EXTRACT(EPOCH FROM (t2.txn_time - t1.txn_time)) / 3600, 2)` |
| MySQL 8    | `ROUND(TIMESTAMPDIFF(SECOND, t1.txn_time, t2.txn_time) / 3600, 2)` |
| SQL Server | `ROUND(DATEDIFF(SECOND, t1.txn_time, t2.txn_time) / 3600.0, 2)` |

Other notes: use `TIMESTAMP` (PostgreSQL) or `DATETIME` (MySQL, SQL Server) for `txn_time`.
Indexes on `(from_account, to_account, txn_time)` keep the self-join fast on large tables.
