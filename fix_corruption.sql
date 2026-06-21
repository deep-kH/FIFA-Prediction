-- ==============================================================================
-- CORRUPTION FIX SCRIPT
-- This script safely resets everyone's gamification inventory and streaks 
-- back to their mathematically correct values by using the audit function.
-- ==============================================================================

-- 1. Slightly modify the audit function to return the user's UUID so we can join it
DROP FUNCTION IF EXISTS audit_player_inventories();

CREATE OR REPLACE FUNCTION audit_player_inventories()
RETURNS TABLE (
  player_id uuid,
  player_name text,
  actual_halal int,
  expected_halal int,
  actual_haram int,
  expected_haram int,
  actual_streak int,
  expected_streak int
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
  FOR v_profile IN SELECT id, display_name, inventory_multiplier, inventory_safety, current_streak FROM public.profiles LOOP
    v_streak := 0;
    v_earned_mult := 0;
    v_earned_safe := 0;
    v_used_mult := 0;
    v_used_safe := 0;

    FOR v_ballot IN 
      SELECT b.played_card, b.accuracy_rate 
      FROM public.ballots b
      JOIN public.matches m ON m.id = b.match_id
      WHERE b.user_id = v_profile.id AND m.is_completed = true
      ORDER BY m.kickoff_time ASC
    LOOP
      IF v_ballot.played_card = 'MULTIPLIER' THEN v_used_mult := v_used_mult + 1; END IF;
      IF v_ballot.played_card = 'SAFETY_NET' THEN v_used_safe := v_used_safe + 1; END IF;

      IF v_ballot.accuracy_rate = 100 THEN v_earned_safe := v_earned_safe + 1; END IF;

      IF v_ballot.accuracy_rate >= 25 THEN
        v_streak := v_streak + 1;
        IF v_streak > 0 AND v_streak % 5 = 0 THEN v_earned_mult := v_earned_mult + 1; END IF;
      ELSE
        IF coalesce(v_ballot.played_card, 'NONE') != 'SAFETY_NET' THEN v_streak := 0; END IF;
      END IF;
    END LOOP;

    player_id := v_profile.id;
    player_name := v_profile.display_name;
    actual_halal := v_profile.inventory_multiplier;
    expected_halal := v_earned_mult - v_used_mult;
    actual_haram := v_profile.inventory_safety;
    expected_haram := v_earned_safe - v_used_safe;
    actual_streak := v_profile.current_streak;
    expected_streak := v_streak;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 2. INSTANTLY FIX THE DATA CORRUPTION
-- Copy the mathematically verified expected values directly into the profiles table
UPDATE public.profiles p
SET 
  inventory_multiplier = a.expected_halal,
  inventory_safety = a.expected_haram,
  current_streak = a.expected_streak
FROM public.audit_player_inventories() a
WHERE p.id = a.player_id;

-- 3. Show the newly cleaned table
SELECT display_name, inventory_multiplier as fixed_halal_balance, inventory_safety as fixed_haram_balance, current_streak as fixed_streak 
FROM public.profiles 
ORDER BY display_name ASC;
