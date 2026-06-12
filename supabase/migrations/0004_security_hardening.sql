git -- =============================================
-- Migration: Security Hardening (Patching Loopholes)
-- =============================================

-- 1. Prevent users from artificially inflating their points or becoming admin
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_security ON public.profiles;
CREATE TRIGGER enforce_profile_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.block_sensitive_profile_updates();


-- 2. Prevent users from manually updating their earned points on ballots
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ballot_points_security ON public.ballots;
CREATE TRIGGER enforce_ballot_points_security
  BEFORE UPDATE ON public.ballots
  FOR EACH ROW EXECUTE PROCEDURE public.block_sensitive_ballot_updates();


-- 3. Prevent users from manually updating their earned points on poll answers
CREATE OR REPLACE FUNCTION public.block_sensitive_poll_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.points_earned IS DISTINCT FROM OLD.points_earned THEN
      RAISE EXCEPTION 'Security Violation: Cannot manually update poll points.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_poll_points_security ON public.poll_answers;
CREATE TRIGGER enforce_poll_points_security
  BEFORE UPDATE ON public.poll_answers
  FOR EACH ROW EXECUTE PROCEDURE public.block_sensitive_poll_updates();


-- 4. Prevent DELETE on ballots and poll_answers after kickoff
-- (Users could delete bad predictions after a match starts to hide them, though it yields 0 points either way, it breaks history)
CREATE OR REPLACE FUNCTION public.check_kickoff_before_delete_ballot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kickoff_time timestamptz;
BEGIN
  SELECT kickoff_time INTO v_kickoff_time FROM public.matches WHERE id = OLD.match_id;
  IF now() >= v_kickoff_time THEN
    RAISE EXCEPTION 'Cannot delete ballot after match kickoff.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_ballot_delete_lock ON public.ballots;
CREATE TRIGGER enforce_ballot_delete_lock
  BEFORE DELETE ON public.ballots
  FOR EACH ROW EXECUTE PROCEDURE public.check_kickoff_before_delete_ballot();

CREATE OR REPLACE FUNCTION public.check_kickoff_before_delete_poll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_kickoff_time timestamptz;
BEGIN
  SELECT m.kickoff_time INTO v_kickoff_time 
  FROM public.matches m
  JOIN public.custom_polls cp ON cp.match_id = m.id
  WHERE cp.id = OLD.poll_id;
  IF now() >= v_kickoff_time THEN
    RAISE EXCEPTION 'Cannot delete poll answer after match kickoff.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_poll_delete_lock ON public.poll_answers;
CREATE TRIGGER enforce_poll_delete_lock
  BEFORE DELETE ON public.poll_answers
  FOR EACH ROW EXECUTE PROCEDURE public.check_kickoff_before_delete_poll();
