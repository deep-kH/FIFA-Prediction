-- Trigger function to delete ALL events when a match is completed
CREATE OR REPLACE FUNCTION purge_chats_on_match_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- If is_completed changed from false to true
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        -- Delete all events for this match
        DELETE FROM live_room_events
        WHERE match_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger is already attached, but we replaced the function so it will use this new logic.
