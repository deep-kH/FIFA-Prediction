-- =============================================
-- Migration: Phase 3 Gamification (Global Props Revamp)
-- =============================================

-- 1. Drop old Live Arena / Universal Polls tables
DROP TABLE IF EXISTS public.live_room_events CASCADE;
DROP TABLE IF EXISTS public.universal_poll_answers CASCADE;
DROP TABLE IF EXISTS public.universal_polls CASCADE;

-- 2. Create Global Props Tables
CREATE TABLE IF NOT EXISTS public.global_props (
  id                      serial primary key,
  question                text not null,
  answer_type             text not null check (answer_type in ('PLAYER', 'TEAM', 'NUMBER', 'TEXT')),
  closes_at               timestamptz not null,
  is_settled              boolean default false not null,
  correct_answer_text     text,
  correct_answer_player_id integer references public.players(id),
  correct_answer_team_id   integer references public.teams(id),
  created_at              timestamptz default now() not null
);

CREATE TABLE IF NOT EXISTS public.global_prop_answers (
  id               serial primary key,
  prop_id          integer references public.global_props(id) on delete cascade not null,
  user_id          uuid references public.profiles(id) on delete cascade not null,
  answer_text      text,
  answer_player_id integer references public.players(id),
  answer_team_id   integer references public.teams(id),
  points_earned    numeric(8,2) default 0.00 not null,
  unique(prop_id, user_id)
);

-- 3. RLS Policies
ALTER TABLE public.global_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_prop_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read global props" ON public.global_props;
CREATE POLICY "Anyone can read global props" ON public.global_props FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin manage global props" ON public.global_props;
CREATE POLICY "Admin manage global props" ON public.global_props FOR ALL USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users insert/update own answers before close" ON public.global_prop_answers;
CREATE POLICY "Users insert/update own answers before close" ON public.global_prop_answers FOR ALL USING (
  auth.uid() = user_id AND 
  EXISTS (SELECT 1 FROM public.global_props gp WHERE gp.id = prop_id AND now() < gp.closes_at)
);

DROP POLICY IF EXISTS "Read all answers after close" ON public.global_prop_answers;
CREATE POLICY "Read all answers after close" ON public.global_prop_answers FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  EXISTS (SELECT 1 FROM public.global_props gp WHERE gp.id = prop_id AND now() >= gp.closes_at)
);

DROP POLICY IF EXISTS "Admin manage answers" ON public.global_prop_answers;
CREATE POLICY "Admin manage answers" ON public.global_prop_answers FOR ALL USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- 4. Create function to recalculate leaderboard points for everyone
CREATE OR REPLACE FUNCTION public.recalculate_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET total_points = (
    SELECT coalesce(sum(b.points_earned), 0) FROM public.ballots b WHERE b.user_id = p.id
  ) + (
    SELECT coalesce(sum(gpa.points_earned), 0) FROM public.global_prop_answers gpa WHERE gpa.user_id = p.id
  )
  WHERE p.id IS NOT NULL;
END;
$$;

-- 5. Update settle_match to use recalculate_leaderboard at the end
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
      IF v_accuracy >= 80 THEN
        v_total_ballot_pts := v_total_ballot_pts * 2.0;
      ELSE
        v_total_ballot_pts := v_total_ballot_pts * 0.75;
      END IF;
    ELSIF v_ballot.played_card = 'SAFETY_NET' THEN
      IF v_total_ballot_pts < 2.50 THEN
        v_total_ballot_pts := 2.50;
      END IF;
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
  WHERE EXISTS (
    SELECT 1 FROM public.ballots b WHERE b.user_id = p.id AND b.match_id = p_match_id AND b.accuracy_rate >= 25
  );

  UPDATE public.profiles p
  SET current_streak = 0
  WHERE EXISTS (
    SELECT 1 FROM public.ballots b WHERE b.user_id = p.id AND b.match_id = p_match_id AND b.accuracy_rate < 25 AND b.played_card != 'SAFETY_NET'
  );

  UPDATE public.profiles p
  SET inventory_multiplier = inventory_multiplier + 1
  WHERE current_streak > 0 AND current_streak % 5 = 0 AND EXISTS (
    SELECT 1 FROM public.ballots b WHERE b.user_id = p.id AND b.match_id = p_match_id AND b.accuracy_rate >= 25
  );

  -- Recalculate leaderboard
  PERFORM public.recalculate_leaderboard();

END;
$$;
