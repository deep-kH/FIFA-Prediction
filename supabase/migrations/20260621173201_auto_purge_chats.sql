-- Trigger function to delete CHAT events when a match is completed
CREATE OR REPLACE FUNCTION purge_chats_on_match_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- If is_completed changed from false to true
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        -- Delete all CHAT events for this match
        DELETE FROM live_room_events
        WHERE match_id = NEW.id AND event_type = 'CHAT';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to matches table
DROP TRIGGER IF EXISTS trg_purge_chats_on_match_completion ON matches;
CREATE TRIGGER trg_purge_chats_on_match_completion
AFTER UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION purge_chats_on_match_completion();
