-- ==============================================================================
-- REMOVE BAD TRIGGER FROM PRODUCTION
-- Run this script in your Supabase SQL Editor.
-- This removes the chat purge trigger that is causing the "live_room_events" error.
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_purge_chats_on_match_completion ON matches;
DROP FUNCTION IF EXISTS purge_chats_on_match_completion();
