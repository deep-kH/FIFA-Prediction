-- Function to clean up live arena events if match is over 150 mins or completed
CREATE OR REPLACE FUNCTION public.cleanup_match_chats(p_match_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match public.matches%ROWTYPE;
BEGIN
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
    
    IF v_match.is_completed = true OR now() >= v_match.kickoff_time + interval '150 minutes' THEN
        DELETE FROM public.live_room_events WHERE match_id = p_match_id;
        DELETE FROM public.live_user_polls WHERE match_id = p_match_id;
        DELETE FROM public.live_user_poll_votes WHERE poll_id IN (SELECT id FROM public.live_user_polls WHERE match_id = p_match_id);
    END IF;
END;
$$;

-- Trigger to clean up automatically when match is settled
CREATE OR REPLACE FUNCTION public.trigger_cleanup_chats_on_settle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.is_completed = true AND OLD.is_completed = false THEN
        PERFORM public.cleanup_match_chats(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_chats_on_settle_trigger ON public.matches;
CREATE TRIGGER cleanup_chats_on_settle_trigger
AFTER UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.trigger_cleanup_chats_on_settle();
