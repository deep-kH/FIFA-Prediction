-- ==============================================================================
-- AUDIT SCRIPT 2: SCORES & POINTS AUDIT
-- Run in Supabase SQL Editor.
-- This checks:
--   A) Per-match ballot point breakdown (are individual components correct?)
--   B) Total points on profile vs sum of all ballot points + global prop points
-- ==============================================================================


-- ═══════════════════════════════════════════════════════════════
-- PART A: Per-user total points audit
-- Compares profiles.total_points vs SUM(ballots.points_earned) + SUM(global_prop_answers.points_earned)
-- ═══════════════════════════════════════════════════════════════
SELECT
  p.display_name AS "Player",
  p.total_points AS "Profile Total",
  coalesce(ballot_sum.pts, 0) AS "Sum of Ballot Pts",
  coalesce(global_sum.pts, 0) AS "Sum of Global Prop Pts",
  coalesce(ballot_sum.pts, 0) + coalesce(global_sum.pts, 0) AS "Expected Total",
  CASE 
    WHEN p.total_points != coalesce(ballot_sum.pts, 0) + coalesce(global_sum.pts, 0) 
    THEN '❌ MISMATCH (diff: ' || (p.total_points - (coalesce(ballot_sum.pts, 0) + coalesce(global_sum.pts, 0)))::text || ')'
    ELSE '✅ OK' 
  END AS "Status"
FROM public.profiles p
LEFT JOIN (
  SELECT user_id, round(sum(points_earned), 2) AS pts FROM public.ballots GROUP BY user_id
) ballot_sum ON ballot_sum.user_id = p.id
LEFT JOIN (
  SELECT user_id, round(sum(points_earned), 2) AS pts FROM public.global_prop_answers GROUP BY user_id
) global_sum ON global_sum.user_id = p.id
ORDER BY p.display_name;


-- ═══════════════════════════════════════════════════════════════
-- PART B: Per-match per-user ballot breakdown
-- Shows every ballot with its component scores, the stored total,
-- and whether the stored total matches the expected sum of components.
-- ═══════════════════════════════════════════════════════════════
SELECT
  p.display_name AS "Player",
  ht.name || ' vs ' || at.name AS "Match",
  m.home_score || '-' || m.away_score AS "Result",
  b.predicted_home_score || '-' || b.predicted_away_score AS "Prediction",
  b.score_points_earned AS "Score Pts",
  b.team_points_earned AS "Team Pts",
  coalesce(poll_pts.pts, 0) AS "MCQ Pts",
  b.accuracy_rate AS "Accuracy %",
  b.accuracy_bonus_earned AS "Acc Bonus",
  b.played_card AS "Card",
  b.points_earned AS "Stored Total",
  -- Recalculate expected total from components
  (
    CASE
      WHEN b.played_card = 'MULTIPLIER' THEN
        CASE
          WHEN b.accuracy_rate >= 80 THEN
            round((b.score_points_earned + b.team_points_earned + coalesce(poll_pts.pts, 0) + b.accuracy_bonus_earned) * 2.0, 2)
          ELSE
            round((b.score_points_earned + b.team_points_earned + coalesce(poll_pts.pts, 0) + b.accuracy_bonus_earned) * 0.75, 2)
        END
      WHEN b.played_card = 'SAFETY_NET' THEN
        GREATEST(
          round(b.score_points_earned + b.team_points_earned + coalesce(poll_pts.pts, 0) + b.accuracy_bonus_earned, 2),
          2.50
        )
      ELSE
        round(b.score_points_earned + b.team_points_earned + coalesce(poll_pts.pts, 0) + b.accuracy_bonus_earned, 2)
    END
  ) AS "Expected Total",
  CASE
    WHEN b.points_earned != (
      CASE
        WHEN b.played_card = 'MULTIPLIER' THEN
          CASE
            WHEN b.accuracy_rate >= 80 THEN
              round((b.score_points_earned + b.team_points_earned + coalesce(poll_pts.pts, 0) + b.accuracy_bonus_earned) * 2.0, 2)
            ELSE
              round((b.score_points_earned + b.team_points_earned + coalesce(poll_pts.pts, 0) + b.accuracy_bonus_earned) * 0.75, 2)
          END
        WHEN b.played_card = 'SAFETY_NET' THEN
          GREATEST(
            round(b.score_points_earned + b.team_points_earned + coalesce(poll_pts.pts, 0) + b.accuracy_bonus_earned, 2),
            2.50
          )
        ELSE
          round(b.score_points_earned + b.team_points_earned + coalesce(poll_pts.pts, 0) + b.accuracy_bonus_earned, 2)
      END
    ) THEN '❌ MISMATCH'
    ELSE '✅'
  END AS "Status"
FROM public.ballots b
JOIN public.profiles p ON p.id = b.user_id
JOIN public.matches m ON m.id = b.match_id
JOIN public.teams ht ON ht.id = m.home_team_id
JOIN public.teams at ON at.id = m.away_team_id
LEFT JOIN (
  SELECT pa.user_id, cp.match_id, round(sum(pa.points_earned), 2) AS pts
  FROM public.poll_answers pa
  JOIN public.custom_polls cp ON cp.id = pa.poll_id
  GROUP BY pa.user_id, cp.match_id
) poll_pts ON poll_pts.user_id = b.user_id AND poll_pts.match_id = b.match_id
WHERE m.is_completed = true
ORDER BY m.kickoff_time ASC, p.display_name;


-- ═══════════════════════════════════════════════════════════════
-- PART C: Quick summary - only show mismatches
-- ═══════════════════════════════════════════════════════════════
SELECT '--- MISMATCHED TOTALS ---' AS "Section";

SELECT
  p.display_name AS "Player",
  p.total_points AS "Profile Total",
  coalesce(ballot_sum.pts, 0) + coalesce(global_sum.pts, 0) AS "Expected Total",
  p.total_points - (coalesce(ballot_sum.pts, 0) + coalesce(global_sum.pts, 0)) AS "Difference"
FROM public.profiles p
LEFT JOIN (
  SELECT user_id, round(sum(points_earned), 2) AS pts FROM public.ballots GROUP BY user_id
) ballot_sum ON ballot_sum.user_id = p.id
LEFT JOIN (
  SELECT user_id, round(sum(points_earned), 2) AS pts FROM public.global_prop_answers GROUP BY user_id
) global_sum ON global_sum.user_id = p.id
WHERE p.total_points != coalesce(ballot_sum.pts, 0) + coalesce(global_sum.pts, 0)
ORDER BY abs(p.total_points - (coalesce(ballot_sum.pts, 0) + coalesce(global_sum.pts, 0))) DESC;
