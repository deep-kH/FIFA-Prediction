-- =============================================
-- Migration: Lock predictions after match kickoff
-- =============================================

-- 1. Trigger function for ballots
CREATE OR REPLACE FUNCTION public.check_ballot_kickoff_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kickoff_time timestamptz;
BEGIN
  -- Get the kickoff time of the associated match
  SELECT kickoff_time INTO v_kickoff_time FROM public.matches WHERE id = NEW.match_id;
  
  -- If the match has already kicked off (or is currently kicking off)
  IF now() >= v_kickoff_time THEN
    -- On INSERT, block entirely
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Cannot submit ballot. Match has already kicked off.';
    END IF;
    
    -- On UPDATE, block only if prediction columns are being changed
    IF TG_OP = 'UPDATE' THEN
      IF NEW.predicted_home_score IS DISTINCT FROM OLD.predicted_home_score OR
         NEW.predicted_away_score IS DISTINCT FROM OLD.predicted_away_score OR
         NEW.predicted_top_scorer_id IS DISTINCT FROM OLD.predicted_top_scorer_id THEN
         RAISE EXCEPTION 'Cannot update predictions. Match has already kicked off.';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS enforce_ballot_kickoff_lock ON public.ballots;
CREATE TRIGGER enforce_ballot_kickoff_lock
  BEFORE INSERT OR UPDATE ON public.ballots
  FOR EACH ROW EXECUTE PROCEDURE public.check_ballot_kickoff_lock();

-- 2. Trigger function for poll_answers
CREATE OR REPLACE FUNCTION public.check_poll_kickoff_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kickoff_time timestamptz;
BEGIN
  -- Get the kickoff time of the associated match via custom_polls
  SELECT m.kickoff_time INTO v_kickoff_time 
  FROM public.matches m
  JOIN public.custom_polls cp ON cp.match_id = m.id
  WHERE cp.id = NEW.poll_id;
  
  -- If the match has already kicked off
  IF now() >= v_kickoff_time THEN
    -- On INSERT, block entirely
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Cannot submit poll answer. Match has already kicked off.';
    END IF;
    
    -- On UPDATE, block only if selected_option is changed
    IF TG_OP = 'UPDATE' THEN
      IF NEW.selected_option IS DISTINCT FROM OLD.selected_option THEN
         RAISE EXCEPTION 'Cannot change poll answer. Match has already kicked off.';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS enforce_poll_kickoff_lock ON public.poll_answers;
CREATE TRIGGER enforce_poll_kickoff_lock
  BEFORE INSERT OR UPDATE ON public.poll_answers
  FOR EACH ROW EXECUTE PROCEDURE public.check_poll_kickoff_lock();
