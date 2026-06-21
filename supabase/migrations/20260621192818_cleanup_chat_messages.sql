-- Trigger function to delete ONLY chat/reaction events when a match is completed.
-- POLL_DROP events are preserved so polls and their results remain visible in match history.
CREATE OR REPLACE FUNCTION purge_chats_on_match_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- If is_completed changed from false to true
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        -- Delete only chat and reaction events, preserve poll drop events
        DELETE FROM live_room_events
        WHERE match_id = NEW.id
          AND event_type IN ('CHAT', 'REACTION', 'SYSTEM');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger is already attached, but we replaced the function so it will use this new logic.
