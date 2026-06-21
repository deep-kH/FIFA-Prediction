-- =============================================
-- Migration: Phase 2 Gamification (Bounty, Global Polls, Live Arena)
-- =============================================



-- 2. Universal Polls & Answers
CREATE TABLE IF NOT EXISTS public.universal_polls (
  id              serial primary key,
  type            text not null check (type in ('GLOBAL', 'FLASH')),
  match_id        integer references public.matches(id) on delete cascade,
  question        text not null,
  option_a        text not null,
  option_b        text not null,
  option_c        text not null,
  option_d        text not null,
  correct_option  char(1) check (correct_option in ('A','B','C','D')),
  closes_at       timestamptz not null,
  is_settled      boolean default false not null,
  created_at      timestamptz default now() not null
);

CREATE TABLE IF NOT EXISTS public.universal_poll_answers (
  id              serial primary key,
  poll_id         integer references public.universal_polls(id) on delete cascade not null,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  selected_option char(1) not null check (selected_option in ('A','B','C','D')),
  points_earned   numeric(8,2) default 0.00 not null,
  unique(poll_id, user_id)
);

-- 3. Live Prediction Room Events Engine
CREATE TABLE IF NOT EXISTS public.live_room_events (
  id               serial primary key,
  match_id         integer references public.matches(id) on delete cascade not null,
  user_id          uuid references public.profiles(id) on delete cascade not null,
  event_type       text not null check (event_type in ('CHAT', 'REACTION', 'POLL_DROP')),
  content          text,
  embedded_poll_id integer references public.universal_polls(id) on delete cascade,
  created_at       timestamptz default now() not null
);

-- 4. Enable RLS
ALTER TABLE public.universal_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universal_poll_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_room_events ENABLE ROW LEVEL SECURITY;

-- 5. Security Policies
-- Universal Polls: Read-all, Admin-write
DROP POLICY IF EXISTS "Anyone can read universal polls" ON public.universal_polls;
CREATE POLICY "Anyone can read universal polls" ON public.universal_polls FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin manage universal polls" ON public.universal_polls;
CREATE POLICY "Admin manage universal polls" ON public.universal_polls FOR ALL USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- Universal Poll Answers: Users manage their own BEFORE closes_at, read-all AFTER closes_at. Admin read-all.
DROP POLICY IF EXISTS "Users insert/update own answers before close" ON public.universal_poll_answers;
CREATE POLICY "Users insert/update own answers before close" ON public.universal_poll_answers FOR ALL USING (
  auth.uid() = user_id AND 
  EXISTS (SELECT 1 FROM public.universal_polls up WHERE up.id = poll_id AND now() < up.closes_at)
);

DROP POLICY IF EXISTS "Read all answers after close" ON public.universal_poll_answers;
CREATE POLICY "Read all answers after close" ON public.universal_poll_answers FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  EXISTS (SELECT 1 FROM public.universal_polls up WHERE up.id = poll_id AND now() >= up.closes_at)
);

DROP POLICY IF EXISTS "Admin manage universal answers" ON public.universal_poll_answers;
CREATE POLICY "Admin manage universal answers" ON public.universal_poll_answers FOR ALL USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- Live Room Events: Read-all, Users insert their own.
DROP POLICY IF EXISTS "Anyone can read live events" ON public.live_room_events;
CREATE POLICY "Anyone can read live events" ON public.live_room_events FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users insert own live events" ON public.live_room_events;
CREATE POLICY "Users insert own live events" ON public.live_room_events FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manage live events" ON public.live_room_events;
CREATE POLICY "Admin manage live events" ON public.live_room_events FOR ALL USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()));

-- 6. Enable Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
COMMIT;

-- 7. Update Settle Match for Bounty logic
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



    -- "?"?"? GAMIFICATION WILDCARDS "?"?"?
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

  -- 8. Final Recalculation includes Universal Poll points as well!
  UPDATE public.profiles p
  SET total_points = (
    SELECT coalesce(sum(b.points_earned), 0) FROM public.ballots b WHERE b.user_id = p.id
  ) + (
    SELECT coalesce(sum(up.points_earned), 0) FROM public.universal_poll_answers up WHERE up.user_id = p.id
  )
  WHERE id IN (
    SELECT user_id FROM public.ballots UNION SELECT user_id FROM public.universal_poll_answers
  );

END;
$$;
