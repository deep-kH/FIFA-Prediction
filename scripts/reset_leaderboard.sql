-- Reset Leaderboard Plan
-- 1. Add baseline_points to profiles (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='profiles' AND column_name='baseline_points') THEN
        ALTER TABLE public.profiles ADD COLUMN baseline_points NUMERIC DEFAULT 0;
    END IF;
END $$;

-- 2. Snapshot current points into baseline_points
UPDATE public.profiles
SET baseline_points = total_points;

-- 3. Update recalculate_leaderboard function to subtract baseline_points
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
  ) - coalesce(p.baseline_points, 0)
  WHERE p.id IN (SELECT id FROM public.profiles);
END;
$$;

-- 4. Trigger recalculation so all users' total_points become 0 immediately
SELECT public.recalculate_leaderboard();
