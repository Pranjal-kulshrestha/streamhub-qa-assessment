-- SYNTHETIC sample data. Names and scores are invented, not real IPL records.

-- Scenario 1 data. Comments say what each row is designed to test.
INSERT INTO transactions (txn_id, from_account, to_account, amount, txn_time) VALUES
(1,  'ACC_A', 'ACC_B', 1000.00, '2024-05-01 10:00:00'),  -- pair 1->2: return 950 after 8h, within 10% -> MATCH
(2,  'ACC_B', 'ACC_A',  950.00, '2024-05-01 18:00:00'),
(3,  'ACC_C', 'ACC_D',  500.00, '2024-05-02 09:00:00'),  -- pair 3->4: return 700 is 40% higher -> no match
(4,  'ACC_D', 'ACC_C',  700.00, '2024-05-02 12:00:00'),
(5,  'ACC_E', 'ACC_F',  200.00, '2024-05-03 09:00:00'),  -- pair 5->6: amounts close but 48h later -> no match
(6,  'ACC_F', 'ACC_E',  205.00, '2024-05-05 09:00:00'),
(7,  'ACC_G', 'ACC_H',  100.00, '2024-05-04 09:00:00'),  -- pair 7->8: exactly 24h and +10% -> MATCH (boundary)
(8,  'ACC_H', 'ACC_G',  110.00, '2024-05-05 09:00:00'),
(9,  'ACC_I', 'ACC_J', 1000.00, '2024-05-06 08:00:00'),  -- pair 9->10: 899 is just outside 10% -> no match
(10, 'ACC_J', 'ACC_I',  899.00, '2024-05-06 20:00:00'),
(11, 'ACC_K', 'ACC_L',  300.00, '2024-05-07 08:00:00'),  -- 11 returned twice: 12 (ok) and 13 (ok) -> 2 MATCHES
(12, 'ACC_L', 'ACC_K',  290.00, '2024-05-07 09:00:00'),
(13, 'ACC_L', 'ACC_K',  310.00, '2024-05-07 15:00:00'),
(14, 'ACC_M', 'ACC_N',  400.00, '2024-05-08 09:00:00'),  -- pair 14->15: same amount but 24h and 1 second later -> no match (just outside window)
(15, 'ACC_N', 'ACC_M',  400.00, '2024-05-09 09:00:01'),
(16, 'ACC_O', 'ACC_P',  600.00, '2024-05-09 09:00:00'),  -- same direction repeated is not a round trip
(17, 'ACC_O', 'ACC_P',  600.00, '2024-05-09 10:00:00');

-- Scenario 2 data (2024 season, 4 players with different patterns, plus a 2023 row to test the season filter).
INSERT INTO player_match_stats (player_id, player_name, team, match_id, match_date, runs) VALUES
-- Aarav Mehta: 45,30,52 (streak of 3 from 22 Mar), 10 breaks it, then 35,40 (only 2)
(1, 'Aarav Mehta', 'Mumbai Mariners', 101, '2024-03-22', 45),
(1, 'Aarav Mehta', 'Mumbai Mariners', 102, '2024-03-25', 30),
(1, 'Aarav Mehta', 'Mumbai Mariners', 103, '2024-03-29', 52),
(1, 'Aarav Mehta', 'Mumbai Mariners', 104, '2024-04-02', 10),
(1, 'Aarav Mehta', 'Mumbai Mariners', 105, '2024-04-06', 35),
(1, 'Aarav Mehta', 'Mumbai Mariners', 106, '2024-04-10', 40),
-- Rohan Iyer: 31, 29 (just under 30), then 60,40,33,31 -> streak of 4 from 30 Mar
(2, 'Rohan Iyer', 'Chennai Chargers', 201, '2024-03-24', 31),
(2, 'Rohan Iyer', 'Chennai Chargers', 202, '2024-03-27', 29),
(2, 'Rohan Iyer', 'Chennai Chargers', 203, '2024-03-30', 60),
(2, 'Rohan Iyer', 'Chennai Chargers', 204, '2024-04-03', 40),
(2, 'Rohan Iyer', 'Chennai Chargers', 205, '2024-04-07', 33),
(2, 'Rohan Iyer', 'Chennai Chargers', 206, '2024-04-10', 31),
-- Kabir Nair: two separate streaks of 3 (starts 23 Mar and 12 Apr) -> returns two rows
(3, 'Kabir Nair', 'Kolkata Knights', 301, '2024-03-23', 34),
(3, 'Kabir Nair', 'Kolkata Knights', 302, '2024-03-26', 78),
(3, 'Kabir Nair', 'Kolkata Knights', 303, '2024-03-31', 31),
(3, 'Kabir Nair', 'Kolkata Knights', 304, '2024-04-05', 5),
(3, 'Kabir Nair', 'Kolkata Knights', 305, '2024-04-08', 0),
(3, 'Kabir Nair', 'Kolkata Knights', 306, '2024-04-12', 41),
(3, 'Kabir Nair', 'Kolkata Knights', 307, '2024-04-15', 66),
(3, 'Kabir Nair', 'Kolkata Knights', 308, '2024-04-19', 30),
-- Dev Sharma: only 2 consecutive 30+ scores -> must NOT appear
(4, 'Dev Sharma', 'Delhi Dynamos', 401, '2024-03-28', 50),
(4, 'Dev Sharma', 'Delhi Dynamos', 402, '2024-04-01', 44),
(4, 'Dev Sharma', 'Delhi Dynamos', 403, '2024-04-05', 12),
(4, 'Dev Sharma', 'Delhi Dynamos', 404, '2024-04-09', 70),
-- Ishaan Rao: 3 good scores but the first is in 2023, so only 2 in the 2024 season -> must NOT appear
(5, 'Ishaan Rao', 'Hyderabad Hawks', 501, '2023-12-30', 55),
(5, 'Ishaan Rao', 'Hyderabad Hawks', 502, '2024-03-27', 48),
(5, 'Ishaan Rao', 'Hyderabad Hawks', 503, '2024-04-02', 39);
