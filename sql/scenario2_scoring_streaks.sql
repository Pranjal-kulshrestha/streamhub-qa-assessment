-- Scenario 2: players who scored 30+ runs in at least 3 consecutive matches in the 2024 season.
-- Returns the player's name and the date the streak started (plus the streak length for context).
--
-- Method ("gaps and islands"):
--   rn_all = running number of ALL of the player's 2024 matches, in date order
--   rn_hit = running number of only the matches with the same flag (30+ or not)
--   For 30+ matches, rn_all - rn_hit is constant inside one unbroken streak and changes after a gap.
-- "Consecutive" means consecutive matches the player played, in match date order.
-- A player with two separate qualifying streaks appears twice (once per streak).

WITH season AS (
  SELECT player_id, player_name, match_date, runs,
         CASE WHEN runs >= 30 THEN 1 ELSE 0 END AS hit
  FROM player_match_stats
  WHERE match_date >= '2024-01-01' AND match_date < '2025-01-01'
),
ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY match_date)              AS rn_all,
         ROW_NUMBER() OVER (PARTITION BY player_id, hit ORDER BY match_date)         AS rn_hit
  FROM season
),
islands AS (
  SELECT player_id, player_name, match_date, rn_all - rn_hit AS grp
  FROM ranked
  WHERE hit = 1
)
SELECT player_name,
       MIN(match_date) AS streak_start_date,
       COUNT(*)        AS streak_length
FROM islands
GROUP BY player_id, player_name, grp
HAVING COUNT(*) >= 3
ORDER BY player_name, streak_start_date;
