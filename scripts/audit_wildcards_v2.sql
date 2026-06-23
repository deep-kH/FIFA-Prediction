-- ==============================================================================
-- AUDIT SCRIPT: WILDCARD INVENTORY & STREAKS
-- Returns: user name, available wildcards, streak ends, awarded, used, matches used
-- Run in Supabase SQL Editor.
-- ==============================================================================

DROP FUNCTION IF EXISTS audit_wildcards_v2();
CREATE OR REPLACE FUNCTION audit_wildcards_v2()
RETURNS TABLE (
  user_name text,
  available_wildcards int,
  streak_ends text,
  total_awarded int,
  total_used int,
  matches_used text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_profile record;
  v_ballot record;
  v_streak int;
  v_earned int;
  v_used int;
  v_streak_ends text;
  v_matches_used text;
  v_match_label text;
BEGIN
  FOR v_profile IN SELECT id, display_name, inventory_multiplier, inventory_safety FROM public.profiles LOOP
    v_streak := 0;
    v_earned := 0;
    v_used := 0;
    v_streak_ends := '';
    v_matches_used := '';

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
      IF v_ballot.played_card IN ('MULTIPLIER', 'SAFETY_NET') THEN 
        v_used := v_used + 1; 
        IF length(v_matches_used) > 0 THEN
          v_matches_used := v_matches_used || ', ';
        END IF;
        v_matches_used := v_matches_used || v_match_label || '(' || v_ballot.played_card || ')';
      END IF;

      -- Earned cards logic
      -- 100% accuracy earns a Safety Net
      IF v_ballot.accuracy_rate = 100 THEN 
        v_earned := v_earned + 1; 
      END IF;

      -- Streak logic
      IF v_ballot.accuracy_rate >= 25 THEN
        v_streak := v_streak + 1;
        -- Every 5-streak milestone earns a Multiplier
        IF v_streak > 0 AND v_streak % 5 = 0 THEN
          v_earned := v_earned + 1;
        END IF;
      ELSE
        -- Streak resets unless Safety Net was played
        IF coalesce(v_ballot.played_card, 'NONE') != 'SAFETY_NET' THEN
          IF v_streak > 0 THEN
            IF length(v_streak_ends) > 0 THEN
              v_streak_ends := v_streak_ends || ', ';
            END IF;
            v_streak_ends := v_streak_ends || v_streak;
          END IF;
          v_streak := 0;
        END IF;
      END IF;
    END LOOP;

    -- Include the current unbroken streak if it's > 0
    IF v_streak > 0 THEN
      IF length(v_streak_ends) > 0 THEN
        v_streak_ends := v_streak_ends || ', ';
      END IF;
      v_streak_ends := v_streak_ends || v_streak || ' (active)';
    END IF;

    user_name := v_profile.display_name;
    available_wildcards := coalesce(v_profile.inventory_multiplier, 0) + coalesce(v_profile.inventory_safety, 0);
    streak_ends := v_streak_ends;
    total_awarded := v_earned;
    total_used := v_used;
    matches_used := v_matches_used;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Run the audit query
SELECT 
  user_name AS "User Name",
  available_wildcards AS "Available Wildcards",
  streak_ends AS "Streaks (Broken & Active)",
  total_awarded AS "Total Awarded (Mult + Safety)",
  total_used AS "Total Used",
  matches_used AS "Matches Used"
FROM audit_wildcards_v2()
ORDER BY user_name;
