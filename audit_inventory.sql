-- ==============================================================================
-- INVENTORY AUDIT SCRIPT
-- Run this directly in your Supabase SQL Editor.
-- It recreates the exact historical logic of how cards are earned and used,
-- tallies them up, and compares them against the user's current inventory.
-- ==============================================================================

CREATE OR REPLACE FUNCTION audit_player_inventories()
RETURNS TABLE (
  player_name text,
  status text,
  actual_halal int,
  expected_halal int,
  actual_haram int,
  expected_haram int,
  actual_streak int,
  expected_streak int,
  stats_earned_halal int,
  stats_used_halal int,
  stats_earned_haram int,
  stats_used_haram int
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
BEGIN
  -- Loop through every player
  FOR v_profile IN SELECT id, display_name, inventory_multiplier, inventory_safety, current_streak FROM public.profiles LOOP
    v_streak := 0;
    v_earned_mult := 0;
    v_earned_safe := 0;
    v_used_mult := 0;
    v_used_safe := 0;

    -- Loop through all their completed matches in chronological order
    FOR v_ballot IN 
      SELECT b.played_card, b.accuracy_rate 
      FROM public.ballots b
      JOIN public.matches m ON m.id = b.match_id
      WHERE b.user_id = v_profile.id AND m.is_completed = true
      ORDER BY m.kickoff_time ASC
    LOOP
      -- 1. Track Usage
      IF v_ballot.played_card = 'MULTIPLIER' THEN 
        v_used_mult := v_used_mult + 1; 
      END IF;
      
      IF v_ballot.played_card = 'SAFETY_NET' THEN 
        v_used_safe := v_used_safe + 1; 
      END IF;

      -- 2. Track Haram Ball Earnings (100% accuracy)
      IF v_ballot.accuracy_rate = 100 THEN
        v_earned_safe := v_earned_safe + 1;
      END IF;

      -- 3. Track Streaks & Halal Ball Earnings (>= 25% accuracy)
      IF v_ballot.accuracy_rate >= 25 THEN
        v_streak := v_streak + 1;
        -- Earn Halal ball every multiple of 5
        IF v_streak > 0 AND v_streak % 5 = 0 THEN
          v_earned_mult := v_earned_mult + 1;
        END IF;
      ELSE
        -- Under 25% resets the streak, UNLESS they played a Haram Ball
        IF coalesce(v_ballot.played_card, 'NONE') != 'SAFETY_NET' THEN
          v_streak := 0;
        END IF;
      END IF;
    END LOOP;

    -- Assign outputs
    player_name := v_profile.display_name;
    actual_halal := v_profile.inventory_multiplier;
    expected_halal := v_earned_mult - v_used_mult;
    
    actual_haram := v_profile.inventory_safety;
    expected_haram := v_earned_safe - v_used_safe;
    
    actual_streak := v_profile.current_streak;
    expected_streak := v_streak;
    
    stats_earned_halal := v_earned_mult;
    stats_used_halal := v_used_mult;
    stats_earned_haram := v_earned_safe;
    stats_used_haram := v_used_safe;
    
    -- Check for mismatches
    IF actual_halal != expected_halal OR actual_haram != expected_haram OR actual_streak != expected_streak THEN
      status := '❌ MISMATCH';
    ELSE
      status := '✅ OK';
    END IF;

    -- Send this row to the output table
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Execute the function to see the audit report in the SQL results table
SELECT * FROM audit_player_inventories() ORDER BY status ASC, player_name ASC;
