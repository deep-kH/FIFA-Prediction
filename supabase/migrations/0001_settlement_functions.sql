-- =============================================
-- CupHub Fantasy Engine — UPDATED Point Settlement Function
-- Implements: scores.md comprehensive rules
--   1. Exact Scoreline: +5 pts (exclusive, no double-dip)
--   2. Outcome Accuracy: +2 pts (only if exact missed)
--   3. Team Goal Accuracy: +1 pt per team (consolation)
--   4. Top Scorer: +3 pts
--   5. Admin MCQ: +2 pts each
--   6. Accuracy Rate Bonus: Tier 1 (80%+) = +5, Tier 2 (50-79%) = +2, Tier 3 (<50%) = +0
-- Run this in Supabase SQL Editor to REPLACE the old function.
-- =============================================

-- Step 1: Add new granular columns to ballots if they don't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ballots' and column_name='score_points_earned') then
    alter table public.ballots add column score_points_earned integer default 0 not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ballots' and column_name='team_points_earned') then
    alter table public.ballots add column team_points_earned integer default 0 not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ballots' and column_name='accuracy_rate') then
    alter table public.ballots add column accuracy_rate numeric(5,2) default 0.00 not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ballots' and column_name='accuracy_bonus_earned') then
    alter table public.ballots add column accuracy_bonus_earned integer default 0 not null;
  end if;
end
$$;

-- Step 2: Replace the settlement function with the updated scoring engine
create or replace function public.settle_match(p_match_id integer)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
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
begin
  -- 1. Fetch match details
  select * into v_match from public.matches where id = p_match_id;

  if not found then
    raise exception 'Match % not found', p_match_id;
  end if;

  if not v_match.is_completed then
    raise exception 'Match % is not marked as completed yet', p_match_id;
  end if;

  -- Count MCQ polls for this match (used in accuracy rate calculation)
  select count(*) into v_num_polls from public.custom_polls where match_id = p_match_id;

  -- 2. Determine actual outcome
  if v_match.home_score > v_match.away_score then
    v_outcome_actual := 'HOME';
  elsif v_match.away_score > v_match.home_score then
    v_outcome_actual := 'AWAY';
  else
    v_outcome_actual := 'DRAW';
  end if;

  -- 3. Loop through all ballots for this match
  for v_ballot in
    select * from public.ballots where match_id = p_match_id
  loop
    v_score_pts  := 0;
    v_team_pts   := 0;
    v_scorer_pts := 0;
    v_mcq_pts    := 0;
    v_slots_hit  := 0;

    -- ─── RULE 1 & 2: Exact Scoreline vs Outcome Accuracy ───
    if v_ballot.predicted_home_score is not null and v_ballot.predicted_away_score is not null then
      -- Check exact scoreline first
      if v_ballot.predicted_home_score = v_match.home_score
        and v_ballot.predicted_away_score = v_match.away_score then
        -- EXACT SCORELINE: +5 pts (exclusive — no outcome double-dip)
        v_score_pts := 5;
        v_slots_hit := v_slots_hit + 1; -- counts as 1 slot (scoreline)
      else
        -- Check outcome direction
        if v_ballot.predicted_home_score > v_ballot.predicted_away_score then
          v_outcome_pred := 'HOME';
        elsif v_ballot.predicted_away_score > v_ballot.predicted_home_score then
          v_outcome_pred := 'AWAY';
        else
          v_outcome_pred := 'DRAW';
        end if;

        if v_outcome_pred = v_outcome_actual then
          -- CORRECT OUTCOME (but wrong score): +2 pts
          v_score_pts := 2;
          v_slots_hit := v_slots_hit + 1;
        end if;
      end if;

      -- ─── RULE 3: Team-Specific Goal Accuracy (consolation, always checked) ───
      if v_ballot.predicted_home_score = v_match.home_score then
        v_team_pts := v_team_pts + 1;
        v_slots_hit := v_slots_hit + 1;
      end if;
      if v_ballot.predicted_away_score = v_match.away_score then
        v_team_pts := v_team_pts + 1;
        v_slots_hit := v_slots_hit + 1;
      end if;
    end if;

    -- ─── RULE 4: Top Match Scorer ───
    if v_ballot.predicted_top_scorer_id is not null
      and v_match.top_scorer_id is not null
      and v_ballot.predicted_top_scorer_id = v_match.top_scorer_id then
      v_scorer_pts := 3;
      v_slots_hit := v_slots_hit + 1;
    end if;

    -- ─── RULE 5: MCQ Poll Points ───
    update public.poll_answers pa
    set points_earned = case
        when pa.selected_option = cp.correct_option then 2
        else 0
      end
    from public.custom_polls cp
    where pa.poll_id = cp.id
      and cp.match_id = p_match_id
      and pa.user_id = v_ballot.user_id;

    -- Count how many MCQs this user got right
    select coalesce(sum(case when pa.selected_option = cp.correct_option then 1 else 0 end), 0)
    into v_mcq_pts
    from public.poll_answers pa
    join public.custom_polls cp on cp.id = pa.poll_id
    where cp.match_id = p_match_id
      and pa.user_id = v_ballot.user_id;

    v_slots_hit := v_slots_hit + v_mcq_pts;
    -- MCQ points are 2 per correct, but slots_hit counts each correct as 1 slot
    v_mcq_pts := v_mcq_pts * 2;

    -- ─── RULE 6: Accuracy Rate & Bonus ───
    -- Total available slots: Scoreline/Outcome(1) + HomeGoals(1) + AwayGoals(1) + TopScorer(1) + NumPolls
    v_slots_total := 4 + v_num_polls; -- scoreline, home goals, away goals, top scorer, + each poll

    if v_slots_total > 0 then
      v_accuracy := (v_slots_hit::numeric / v_slots_total::numeric) * 100;
    else
      v_accuracy := 0;
    end if;

    -- Tiered bonus
    if v_accuracy >= 80 then
      v_accuracy_bonus := 5;
    elsif v_accuracy >= 50 then
      v_accuracy_bonus := 2;
    else
      v_accuracy_bonus := 0;
    end if;

    -- ─── TOTAL ───
    v_total_ballot_pts := v_score_pts + v_team_pts + v_scorer_pts + v_mcq_pts + v_accuracy_bonus;

    -- 4. Update ballot with granular breakdown
    update public.ballots
    set points_earned = v_total_ballot_pts,
        score_points_earned = v_score_pts,
        team_points_earned = v_team_pts,
        accuracy_rate = v_accuracy,
        accuracy_bonus_earned = v_accuracy_bonus
    where id = v_ballot.id;

  end loop;

  -- 5. Recalculate all affected users' total_points atomically
  update public.profiles p
  set total_points = (
    select coalesce(sum(b.points_earned), 0)
    from public.ballots b
    where b.user_id = p.id
  )
  where exists (
    select 1 from public.ballots b where b.user_id = p.id
  );

end;
$$;

-- Trigger stays the same (re-create for safety)
create or replace function public.trigger_settle_on_complete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_completed = true and old.is_completed = false then
    perform public.settle_match(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_match_completed on public.matches;
create trigger on_match_completed
  after update of is_completed on public.matches
  for each row execute procedure public.trigger_settle_on_complete();
