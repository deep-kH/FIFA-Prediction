-- Update settle_match to handle the Halal Ball (>=60 / <=40) and Haram Ball (+5.50)
CREATE OR REPLACE FUNCTION public.settle_match(p_match_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match              public.matches%rowtype;
  v_ballot             public.ballots%rowtype;
  v_score_pts          numeric(8,2);
  v_team_pts           numeric(8,2);
  v_scorer_pts         numeric(8,2);
  v_mcq_pts            numeric(8,2);
  v_total_ballot_pts   numeric(8,2);
  v_outcome_actual     text;
  v_outcome_pred       text;
  v_slots_hit          integer;
  v_slots_total        integer;
  v_accuracy           numeric(5,2);
  v_accuracy_bonus     numeric(8,2);
  v_num_polls          integer;
BEGIN
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

  FOR v_ballot IN SELECT * FROM public.ballots WHERE match_id = p_match_id LOOP
    v_score_pts  := 0;
    v_team_pts   := 0;
    v_scorer_pts := 0;
    v_mcq_pts    := 0;
    v_slots_hit  := 0;

    IF v_ballot.predicted_home_score IS NOT NULL AND v_ballot.predicted_away_score IS NOT NULL THEN
      IF v_ballot.predicted_home_score = v_match.home_score AND v_ballot.predicted_away_score = v_match.away_score THEN
        v_score_pts := 5.0;
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
          v_score_pts := 2.0;
          v_slots_hit := v_slots_hit + 1;
        END IF;
      END IF;

      IF v_ballot.predicted_home_score = v_match.home_score THEN
        v_team_pts := v_team_pts + 1.0;
        v_slots_hit := v_slots_hit + 1;
      END IF;
      IF v_ballot.predicted_away_score = v_match.away_score THEN
        v_team_pts := v_team_pts + 1.0;
        v_slots_hit := v_slots_hit + 1;
      END IF;
    END IF;

    IF v_ballot.predicted_top_scorer_id IS NOT NULL AND v_match.top_scorer_id IS NOT NULL AND v_ballot.predicted_top_scorer_id = v_match.top_scorer_id THEN
      v_scorer_pts := 3.0;
      v_slots_hit := v_slots_hit + 1;
    END IF;

    UPDATE public.poll_answers pa
    SET points_earned = CASE WHEN pa.selected_option = cp.correct_option THEN 2.0 ELSE 0.0 END
    FROM public.custom_polls cp
    WHERE pa.poll_id = cp.id AND cp.match_id = p_match_id AND pa.user_id = v_ballot.user_id;

    SELECT coalesce(sum(CASE WHEN pa.selected_option = cp.correct_option THEN 1 ELSE 0 END), 0)
    INTO v_mcq_pts
    FROM public.poll_answers pa
    JOIN public.custom_polls cp ON cp.id = pa.poll_id
    WHERE cp.match_id = p_match_id AND pa.user_id = v_ballot.user_id;

    v_slots_hit := v_slots_hit + v_mcq_pts;
    v_mcq_pts := v_mcq_pts * 2.0;

    v_slots_total := 4 + v_num_polls;
    IF v_slots_total > 0 THEN
      v_accuracy := (v_slots_hit::numeric / v_slots_total::numeric) * 100.0;
    ELSE
      v_accuracy := 0.0;
    END IF;

    IF v_accuracy >= 80 THEN
      v_accuracy_bonus := 5.0;
    ELSIF v_accuracy >= 50 THEN
      v_accuracy_bonus := 2.0;
    ELSE
      v_accuracy_bonus := 0.0;
    END IF;

    v_total_ballot_pts := v_score_pts + v_team_pts + v_scorer_pts + v_mcq_pts + v_accuracy_bonus;



    -- 🃏 GAMIFICATION WILDCARDS 🃏
    IF v_ballot.played_card = 'MULTIPLIER' THEN
      IF v_accuracy >= 60 THEN
        v_total_ballot_pts := v_total_ballot_pts * 2.0;
      ELSIF v_accuracy <= 40 THEN
        v_total_ballot_pts := v_total_ballot_pts * 0.75;
      END IF;
    ELSIF v_ballot.played_card = 'SAFETY_NET' THEN
      v_total_ballot_pts := v_total_ballot_pts + 5.50;
    END IF;

    UPDATE public.ballots
    SET points_earned = round(v_total_ballot_pts, 2),
        score_points_earned = v_score_pts,
        team_points_earned = v_team_pts,
        accuracy_rate = v_accuracy,
        accuracy_bonus_earned = v_accuracy_bonus
    WHERE id = v_ballot.id;

    IF v_accuracy = 100 THEN
      UPDATE public.profiles SET inventory_safety = inventory_safety + 1 WHERE id = v_ballot.user_id;
    END IF;

  END LOOP;

  UPDATE public.profiles p
  SET current_streak = current_streak + 1
  WHERE id IN (
    SELECT user_id FROM public.ballots WHERE match_id = p_match_id AND accuracy_rate >= 25
  );

  UPDATE public.profiles p
  SET current_streak = 0
  WHERE id IN (
    SELECT user_id FROM public.ballots WHERE match_id = p_match_id AND accuracy_rate < 25 AND played_card != 'SAFETY_NET'
  );

  UPDATE public.profiles p
  SET inventory_multiplier = inventory_multiplier + 1
  WHERE current_streak > 0 AND current_streak % 5 = 0 AND id IN (
    SELECT user_id FROM public.ballots WHERE match_id = p_match_id AND accuracy_rate >= 25
  );

  -- Recalculate leaderboard
  PERFORM public.recalculate_leaderboard();

END;
$$;
