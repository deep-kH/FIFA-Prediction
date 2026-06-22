-- =============================================
-- Migration: Fix embedded_poll_id foreign key
-- =============================================

-- The embedded_poll_id in live_room_events was originally created to reference universal_polls.
-- However, LiveArena 2.0 uses it to reference live_user_polls.
-- We must drop the foreign key constraint so we can insert live_user_polls IDs.

DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'live_room_events'
      AND column_name = 'embedded_poll_id'
      AND constraint_catalog = current_database();

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.live_room_events DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;
