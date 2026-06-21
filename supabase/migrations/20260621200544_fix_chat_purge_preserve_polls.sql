-- Fix chat purge trigger: only delete CHAT/REACTION/SYSTEM events.
-- POLL_DROP events are preserved so polls & results remain visible in match history.
CREATE OR REPLACE FUNCTION purge_chats_on_match_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        DELETE FROM live_room_events
        WHERE match_id = NEW.id
          AND event_type IN ('CHAT', 'REACTION', 'SYSTEM');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
