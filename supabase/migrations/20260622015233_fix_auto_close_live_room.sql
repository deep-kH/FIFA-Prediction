-- ==============================================================================
-- Fix: Remove auto-settlement cron job.
-- The live room will close client-side after 150 min or when match is settled.
-- Matches should ONLY be settled manually by admin via settle_match().
-- ==============================================================================

-- 1. Remove the old cron job that was auto-setting is_completed = true
SELECT cron.unschedule('auto-complete-matches');

-- 2. Clean up chat messages for matches that ARE already settled
-- (The trigger handles future settlements, this cleans up any existing ones)
DELETE FROM live_room_events
WHERE event_type IN ('CHAT', 'REACTION', 'SYSTEM')
  AND match_id IN (SELECT id FROM matches WHERE is_completed = true);
