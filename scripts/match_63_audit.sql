-- ==============================================================================
-- AUDIT SCRIPT: DETAILED POINT BREAKDOWN FOR MATCH 63
-- Run in Supabase SQL Editor.
-- Calculates the exact breakdown for every component for match 63.
-- ==============================================================================

SELECT 
  p.display_name AS "Player",
  
  -- 1. Exact Score Points (5 pts if predicted score matches actual score)
  CASE 
    WHEN b.predicted_home_score = m.home_score AND b.predicted_away_score = m.away_score THEN 5.0 
    ELSE 0.0 
  END AS "Exact Score Pts",

  -- 2. Match Result/Outcome Points (2 pts if outcome predicted correctly but exact score is wrong)
  CASE 
    WHEN (b.predicted_home_score = m.home_score AND b.predicted_away_score = m.away_score) THEN 0.0 -- Already got 5 pts above
    WHEN (b.predicted_home_score > b.predicted_away_score AND m.home_score > m.away_score) THEN 2.0
    WHEN (b.predicted_home_score < b.predicted_away_score AND m.home_score < m.away_score) THEN 2.0
    WHEN (b.predicted_home_score = b.predicted_away_score AND m.home_score = m.away_score) THEN 2.0
    ELSE 0.0 
  END AS "Outcome Pts",

  -- 3. Home Team Score Points (1 pt)
  CASE WHEN b.predicted_home_score = m.home_score THEN 1.0 ELSE 0.0 END AS "Home Team Pts",

  -- 4. Away Team Score Points (1 pt)
  CASE WHEN b.predicted_away_score = m.away_score THEN 1.0 ELSE 0.0 END AS "Away Team Pts",

  -- 5. POM / Top Scorer Points (3 pts)
  CASE 
    WHEN b.predicted_top_scorer_id IS NOT NULL AND m.top_scorer_id IS NOT NULL AND b.predicted_top_scorer_id = m.top_scorer_id THEN 3.0 
    ELSE 0.0 
  END AS "POM Pts",

  -- 6. Polls / MCQ Points (2 pts per correct answer)
  COALESCE((
    SELECT sum(pa.points_earned) 
    FROM poll_answers pa 
    JOIN custom_polls cp ON cp.id = pa.poll_id 
    WHERE cp.match_id = 63 AND pa.user_id = b.user_id
  ), 0.0) AS "Polls Pts",

  -- 7. Accuracy Bonus Points (2 or 5 pts)
  b.accuracy_bonus_earned AS "Acc Bonus Pts",

  -- 8. Card Effect applied (if any)
  b.played_card AS "Card Played",

  -- 9. Expected Total Points (Sum of everything above, before multiplier/safety net)
  (
    (CASE WHEN b.predicted_home_score = m.home_score AND b.predicted_away_score = m.away_score THEN 5.0 ELSE 0.0 END) +
    (CASE 
      WHEN (b.predicted_home_score = m.home_score AND b.predicted_away_score = m.away_score) THEN 0.0 
      WHEN (b.predicted_home_score > b.predicted_away_score AND m.home_score > m.away_score) THEN 2.0
      WHEN (b.predicted_home_score < b.predicted_away_score AND m.home_score < m.away_score) THEN 2.0
      WHEN (b.predicted_home_score = b.predicted_away_score AND m.home_score = m.away_score) THEN 2.0
      ELSE 0.0 
    END) +
    (CASE WHEN b.predicted_home_score = m.home_score THEN 1.0 ELSE 0.0 END) +
    (CASE WHEN b.predicted_away_score = m.away_score THEN 1.0 ELSE 0.0 END) +
    (CASE WHEN b.predicted_top_scorer_id IS NOT NULL AND m.top_scorer_id IS NOT NULL AND b.predicted_top_scorer_id = m.top_scorer_id THEN 3.0 ELSE 0.0 END) +
    COALESCE((SELECT sum(pa.points_earned) FROM poll_answers pa JOIN custom_polls cp ON cp.id = pa.poll_id WHERE cp.match_id = 63 AND pa.user_id = b.user_id), 0.0) +
    b.accuracy_bonus_earned
  ) AS "Expected Total (Raw)",

  -- 10. Actual Stored Total Points in DB
  b.points_earned AS "Actual DB Total"

FROM ballots b
JOIN profiles p ON p.id = b.user_id
JOIN matches m ON m.id = b.match_id
WHERE b.match_id = 63
ORDER BY p.display_name;
