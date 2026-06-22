-- ==============================================================================
-- AUDIT SCRIPT 1: WILDCARD INVENTORY & STREAK AUDIT (DETAILED)
-- Run in Supabase SQL Editor.
-- Replays every user's match history chronologically to compute expected values.
-- ==============================================================================

-- 1. Drop old version and recreate
DROP FUNCTION IF EXISTS audit_player_inventories();
CREATE OR REPLACE FUNCTION audit_player_inventories()
RETURNS TABLE (
  player_id uuid,
  player_name text,
  -- Halal Ball (Multiplier)
  halal_earned int,
  halal_used int,
  halal_expected int,
  halal_actual int,
  halal_status text,
  -- Haram Ball (Safety Net)
  haram_earned int,
  haram_used int,
  haram_expected int,
  haram_actual int,
  haram_status text,
  -- Streak
  streak_expected int,
  streak_actual int,
  streak_status text,
  -- Streak history
  streak_history text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile record;
  v_ballot record;
  v_streak int;
  v_earned_mult int;
  v_earned_safe int;
  v_used_mult int;
  v_used_safe int;
  v_history text;
  v_match_label text;
BEGIN
  FOR v_profile IN SELECT id, display_name, inventory_multiplier, inventory_safety, current_streak FROM public.profiles LOOP
    v_streak := 0;
    v_earned_mult := 0;
    v_earned_safe := 0;
    v_used_mult := 0;
    v_used_safe := 0;
    v_history := '';

    FOR v_ballot IN 
      SELECT b.played_card, b.accuracy_rate, ht.name AS home_name, at.name AS away_name
      FROM public.ballots b
      JOIN public.matches m ON m.id = b.match_id
      JOIN public.teams ht ON ht.id = m.home_team_id
      JOIN public.teams at ON at.id = m.away_team_id
      WHERE b.user_id = v_profile.id AND m.is_completed = true
      ORDER BY m.kickoff_time ASC
    LOOP
      v_match_label := substr(v_ballot.home_name, 1, 3) || 'v' || substr(v_ballot.away_name, 1, 3);

      -- Track cards used
      IF v_ballot.played_card = 'MULTIPLIER' THEN v_used_mult := v_used_mult + 1; END IF;
      IF v_ballot.played_card = 'SAFETY_NET' THEN v_used_safe := v_used_safe + 1; END IF;

      -- 100% accuracy earns a Safety Net
      IF v_ballot.accuracy_rate = 100 THEN v_earned_safe := v_earned_safe + 1; END IF;

      -- Streak logic
      IF v_ballot.accuracy_rate >= 25 THEN
        v_streak := v_streak + 1;
        v_history := v_history || v_match_label || '(' || v_streak || '✓) → ';
        -- Every 5-streak milestone earns a Multiplier
        IF v_streak > 0 AND v_streak % 5 = 0 THEN
          v_earned_mult := v_earned_mult + 1;
          v_history := v_history || '🎁HALAL! → ';
        END IF;
      ELSE
        -- Streak resets unless Safety Net was played
        IF coalesce(v_ballot.played_card, 'NONE') != 'SAFETY_NET' THEN
          v_history := v_history || v_match_label || '(💀RESET from ' || v_streak || ') → ';
          v_streak := 0;
        ELSE
          v_history := v_history || v_match_label || '(🛡️SAVED at ' || v_streak || ') → ';
        END IF;
      END IF;
    END LOOP;

    -- Trim trailing arrow
    IF length(v_history) > 4 THEN
      v_history := left(v_history, length(v_history) - 3);
    END IF;

    player_id := v_profile.id;
    player_name := v_profile.display_name;

    halal_earned := v_earned_mult;
    halal_used := v_used_mult;
    halal_expected := v_earned_mult - v_used_mult;
    halal_actual := v_profile.inventory_multiplier;
    halal_status := CASE WHEN v_profile.inventory_multiplier != (v_earned_mult - v_used_mult) THEN '❌' ELSE '✅' END;

    haram_earned := v_earned_safe;
    haram_used := v_used_safe;
    haram_expected := v_earned_safe - v_used_safe;
    haram_actual := v_profile.inventory_safety;
    haram_status := CASE WHEN v_profile.inventory_safety != (v_earned_safe - v_used_safe) THEN '❌' ELSE '✅' END;

    streak_expected := v_streak;
    streak_actual := v_profile.current_streak;
    streak_status := CASE WHEN v_profile.current_streak != v_streak THEN '❌' ELSE '✅' END;

    streak_history := v_history;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 2. Run the audit
SELECT 
  player_name AS "Player",
  '―― HALAL BALL ――' AS " ",
  halal_earned AS "Earned",
  halal_used AS "Used",
  halal_expected AS "Expected Balance",
  halal_actual AS "Actual Balance",
  halal_status AS "✓",
  '―― HARAM BALL ――' AS "  ",
  haram_earned AS "Earned ",
  haram_used AS "Used ",
  haram_expected AS "Expected Balance ",
  haram_actual AS "Actual Balance ",
  haram_status AS "✓ ",
  '―― STREAK ――' AS "   ",
  streak_actual AS "Current Streak",
  streak_expected AS "Expected Streak",
  streak_status AS "✓  "
FROM audit_player_inventories()
ORDER BY player_name;

-- 3. Streak history timeline for each player
SELECT
  player_name AS "Player",
  streak_history AS "Streak Timeline"
FROM audit_player_inventories()
ORDER BY player_name;
