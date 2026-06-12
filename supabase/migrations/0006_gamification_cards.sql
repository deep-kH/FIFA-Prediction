-- =============================================
-- Migration: Gamification Wildcards
-- Features: Halal Ball (Multiplier) & Haram Ball (Safety Net)
-- =============================================

-- 1. Add Inventory Columns to Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inventory_multiplier integer default 0 not null;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inventory_safety integer default 0 not null;

-- 2. Add Played Card Column to Ballots
ALTER TABLE public.ballots ADD COLUMN IF NOT EXISTS played_card text default 'NONE' not null check (played_card in ('NONE', 'MULTIPLIER', 'SAFETY_NET'));

-- 3. Update Security Triggers (Block API updates to inventory and played_card)
CREATE OR REPLACE FUNCTION public.block_sensitive_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If the update is coming directly from the client API
  IF current_user = 'authenticated' THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'Security Violation: Cannot elevate admin privileges.';
    END IF;
    IF NEW.total_points IS DISTINCT FROM OLD.total_points THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually update total_points.';
    END IF;
    IF NEW.current_streak IS DISTINCT FROM OLD.current_streak THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually update streak.';
    END IF;
    IF NEW.inventory_multiplier IS DISTINCT FROM OLD.inventory_multiplier OR NEW.inventory_safety IS DISTINCT FROM OLD.inventory_safety THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually update card inventory.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_sensitive_ballot_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.points_earned IS DISTINCT FROM OLD.points_earned OR
       NEW.score_points_earned IS DISTINCT FROM OLD.score_points_earned OR
       NEW.team_points_earned IS DISTINCT FROM OLD.team_points_earned OR
       NEW.accuracy_rate IS DISTINCT FROM OLD.accuracy_rate OR
       NEW.accuracy_bonus_earned IS DISTINCT FROM OLD.accuracy_bonus_earned THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually update ballot points.';
    END IF;
    IF NEW.played_card IS DISTINCT FROM OLD.played_card THEN
      RAISE EXCEPTION 'Security Violation: Cannot play cards directly. Use the secure RPC function.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Secure RPC to Equip/Unequip Cards
CREATE OR REPLACE FUNCTION public.play_gamification_card(p_match_id integer, p_card_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_ballot_id integer;
  v_current_played text;
  v_inv_mult integer;
  v_inv_safe integer;
  v_kickoff timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Verify match hasn't kicked off
  SELECT kickoff_time INTO v_kickoff FROM public.matches WHERE id = p_match_id;
  IF now() >= v_kickoff THEN RAISE EXCEPTION 'Cannot play card after match kickoff.'; END IF;

  -- Ensure ballot exists
  SELECT id, played_card INTO v_ballot_id, v_current_played FROM public.ballots WHERE match_id = p_match_id AND user_id = v_user_id;
  IF v_ballot_id IS NULL THEN RAISE EXCEPTION 'Ballot not found. Save prediction first.'; END IF;

  -- Fetch current inventory
  SELECT inventory_multiplier, inventory_safety INTO v_inv_mult, v_inv_safe FROM public.profiles WHERE id = v_user_id;

  -- 1. Refund the currently played card (if any)
  IF v_current_played = 'MULTIPLIER' THEN
    v_inv_mult := v_inv_mult + 1;
  ELSIF v_current_played = 'SAFETY_NET' THEN
    v_inv_safe := v_inv_safe + 1;
  END IF;

  -- 2. Deduct the new card
  IF p_card_type = 'MULTIPLIER' THEN
    IF v_inv_mult <= 0 THEN RAISE EXCEPTION 'No Multiplier cards available.'; END IF;
    v_inv_mult := v_inv_mult - 1;
  ELSIF p_card_type = 'SAFETY_NET' THEN
    IF v_inv_safe <= 0 THEN RAISE EXCEPTION 'No Safety Net cards available.'; END IF;
    v_inv_safe := v_inv_safe - 1;
  ELSIF p_card_type != 'NONE' THEN
    RAISE EXCEPTION 'Invalid card type.';
  END IF;

  -- 3. Save state
  UPDATE public.profiles SET inventory_multiplier = v_inv_mult, inventory_safety = v_inv_safe WHERE id = v_user_id;
  UPDATE public.ballots SET played_card = p_card_type WHERE id = v_ballot_id;
END;
$$;


-- 5. Update settle_match with Gamification Logic
CREATE OR REPLACE FUNCTION public.settle_match(p_match_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match              public.matches%rowtype;
  v_ballot             public.ballots%rowtype;
  v_score_pts          integer;
  v_team_pts           integer;
  v_scorer_pts         integer;
  v_mcq_pts            integer;
  v_total_ballot_pts   integer;
  v_outcome_actual     text;
  v_outcome_pred       text;
  v_slots_hit          integer;
  v_slots_total        integer;
  v_accuracy           numeric(5,2);
  v_accuracy_bonus     integer;
  v_num_polls          integer;
BEGIN
  -- Fetch match details
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match % not found', p_match_id; END IF;
  IF NOT v_match.is_completed THEN RAISE EXCEPTION 'Match % is not marked as completed yet', p_match_id; END IF;

  SELECT count(*) INTO v_num_polls FROM public.custom_polls WHERE match_id = p_match_id;

  IF v_match.home_score > v_match.away_score THEN
    v_outcome_actual := 'HOME';
  ELSIF v_match.away_score > v_match.home_score THEN
    v_outcome_actual := 'AWAY';
  ELSE
    v_outcome_actual := 'DRAW';
  END IF;

  -- Loop through ballots
  FOR v_ballot IN SELECT * FROM public.ballots WHERE match_id = p_match_id LOOP
    v_score_pts  := 0;
    v_team_pts   := 0;
    v_scorer_pts := 0;
    v_mcq_pts    := 0;
    v_slots_hit  := 0;

    -- RULE 1 & 2: Exact Scoreline vs Outcome Accuracy
    IF v_ballot.predicted_home_score IS NOT NULL AND v_ballot.predicted_away_score IS NOT NULL THEN
      IF v_ballot.predicted_home_score = v_match.home_score AND v_ballot.predicted_away_score = v_match.away_score THEN
        v_score_pts := 5;
        v_slots_hit := v_slots_hit + 1;
      ELSE
        IF v_ballot.predicted_home_score > v_ballot.predicted_away_score THEN
          v_outcome_pred := 'HOME';
        ELSIF v_ballot.predicted_away_score > v_ballot.predicted_home_score THEN
          v_outcome_pred := 'AWAY';
        ELSE
          v_outcome_pred := 'DRAW';
        END IF;

        IF v_outcome_pred = v_outcome_actual THEN
          v_score_pts := 2;
          v_slots_hit := v_slots_hit + 1;
        END IF;
      END IF;

      -- RULE 3: Team-Specific Goals
      IF v_ballot.predicted_home_score = v_match.home_score THEN
        v_team_pts := v_team_pts + 1;
        v_slots_hit := v_slots_hit + 1;
      END IF;
      IF v_ballot.predicted_away_score = v_match.away_score THEN
        v_team_pts := v_team_pts + 1;
        v_slots_hit := v_slots_hit + 1;
      END IF;
    END IF;

    -- RULE 4: Top Match Scorer
    IF v_ballot.predicted_top_scorer_id IS NOT NULL AND v_match.top_scorer_id IS NOT NULL AND v_ballot.predicted_top_scorer_id = v_match.top_scorer_id THEN
      v_scorer_pts := 3;
      v_slots_hit := v_slots_hit + 1;
    END IF;

    -- RULE 5: MCQ Polls
    UPDATE public.poll_answers pa
    SET points_earned = CASE WHEN pa.selected_option = cp.correct_option THEN 2 ELSE 0 END
    FROM public.custom_polls cp
    WHERE pa.poll_id = cp.id AND cp.match_id = p_match_id AND pa.user_id = v_ballot.user_id;

    SELECT coalesce(sum(CASE WHEN pa.selected_option = cp.correct_option THEN 1 ELSE 0 END), 0)
    INTO v_mcq_pts
    FROM public.poll_answers pa
    JOIN public.custom_polls cp ON cp.id = pa.poll_id
    WHERE cp.match_id = p_match_id AND pa.user_id = v_ballot.user_id;

    v_slots_hit := v_slots_hit + v_mcq_pts;
    v_mcq_pts := v_mcq_pts * 2;

    -- RULE 6: Accuracy Bonus
    v_slots_total := 4 + v_num_polls;
    IF v_slots_total > 0 THEN
      v_accuracy := (v_slots_hit::numeric / v_slots_total::numeric) * 100;
    ELSE
      v_accuracy := 0;
    END IF;

    IF v_accuracy >= 80 THEN
      v_accuracy_bonus := 5;
    ELSIF v_accuracy >= 50 THEN
      v_accuracy_bonus := 2;
    ELSE
      v_accuracy_bonus := 0;
    END IF;

    -- BASE TOTAL
    v_total_ballot_pts := v_score_pts + v_team_pts + v_scorer_pts + v_mcq_pts + v_accuracy_bonus;

    -- ─── GAMIFICATION WILDCARDS ───
    IF v_ballot.played_card = 'MULTIPLIER' THEN
      IF v_score_pts = 5 THEN
        -- Exact Score: 2.0x Multiplier
        v_total_ballot_pts := v_total_ballot_pts * 2;
      ELSE
        -- Missed Exact Score: 0.5x Penalty
        v_total_ballot_pts := floor(v_total_ballot_pts * 0.5);
      END IF;
    ELSIF v_ballot.played_card = 'SAFETY_NET' THEN
      IF v_total_ballot_pts = 0 THEN
        -- Safety Net Override: 50% of Absolute Maximum Possible Points
        v_total_ballot_pts := ceil((15.0 + (v_num_polls * 2.0)) / 2.0);
      END IF;
    END IF;

    -- UPDATE BALLOT
    UPDATE public.ballots
    SET points_earned = v_total_ballot_pts,
        score_points_earned = v_score_pts,
        team_points_earned = v_team_pts,
        accuracy_rate = v_accuracy,
        accuracy_bonus_earned = v_accuracy_bonus
    WHERE id = v_ballot.id;

    -- ─── WILDCARD REWARDS ───
    -- Award Safety Net for 100% Accuracy
    IF v_accuracy = 100 THEN
      UPDATE public.profiles SET inventory_safety = inventory_safety + 1 WHERE id = v_ballot.user_id;
    END IF;

  END LOOP;

  -- 5. Recalculate Streaks
  UPDATE public.profiles p
  SET current_streak = current_streak + 1
  WHERE EXISTS (
    SELECT 1 FROM public.ballots b WHERE b.user_id = p.id AND b.match_id = p_match_id AND b.points_earned > 0
  );

  UPDATE public.profiles p
  SET current_streak = 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ballots b WHERE b.user_id = p.id AND b.match_id = p_match_id AND b.points_earned > 0
  );

  -- Reward Multipliers for Streak milestones (5, 10, 15, etc.)
  -- We only want to reward it for the users who JUST hit the milestone on THIS match
  UPDATE public.profiles p
  SET inventory_multiplier = inventory_multiplier + 1
  WHERE current_streak > 0 AND current_streak % 5 = 0 AND EXISTS (
    SELECT 1 FROM public.ballots b WHERE b.user_id = p.id AND b.match_id = p_match_id AND b.points_earned > 0
  );

  -- 6. Recalculate Total Points
  UPDATE public.profiles p
  SET total_points = (
    SELECT coalesce(sum(b.points_earned), 0) FROM public.ballots b WHERE b.user_id = p.id
  )
  WHERE EXISTS (
    SELECT 1 FROM public.ballots b WHERE b.user_id = p.id
  );

END;
$$;
