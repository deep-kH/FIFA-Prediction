-- Update recalculate_leaderboard to only count matches >= 87
CREATE OR REPLACE FUNCTION public.recalculate_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET total_points = (
    SELECT coalesce(sum(b.points_earned), 0) FROM public.ballots b WHERE b.user_id = p.id AND b.match_id >= 87
  ) + (
    SELECT coalesce(sum(gpa.points_earned), 0) FROM public.global_prop_answers gpa WHERE gpa.user_id = p.id
  )
  WHERE p.id IN (SELECT id FROM public.profiles);
END;
$$;

-- Reset streaks to 0 to wipe history before match 87
UPDATE public.profiles
SET current_streak = 0;

-- Trigger a recalculation to update everyone's points immediately
SELECT public.recalculate_leaderboard();
