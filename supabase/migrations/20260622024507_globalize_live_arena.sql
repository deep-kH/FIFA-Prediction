-- =============================================
-- Migration: Globalize Live Arena
-- =============================================

-- 1. Make match_id nullable for global messages and polls
ALTER TABLE public.live_room_events ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE public.live_user_polls ALTER COLUMN match_id DROP NOT NULL;

-- 2. Create pg_cron job to automatically purge CHAT events older than 24 hours
-- Only purges event_type = 'CHAT'. POLL_DROP and actual polls are preserved.
SELECT cron.schedule(
    'purge_old_global_chat',
    '0 * * * *', -- Run every hour
    $$ 
        DELETE FROM public.live_room_events 
        WHERE event_type = 'CHAT' AND created_at < now() - interval '24 hours';
    $$
);
