-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- Schedule a job to run every minute
-- It checks if any match has passed 150 minutes since its kickoff_time
-- If so, it marks it as completed.
-- Our existing trigger will then automatically delete the chat events!
SELECT cron.schedule(
  'auto-complete-matches', 
  '* * * * *',
  $$
    UPDATE public.matches
    SET is_completed = true
    WHERE is_completed = false
      AND kickoff_time + interval '150 minutes' <= now();
  $$
);
