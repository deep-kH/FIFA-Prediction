-- =============================================
-- Migration: Live Arena 2.0 Expansion
-- =============================================

-- 1. Persistent Live Chat & Events
CREATE TABLE IF NOT EXISTS public.live_room_events (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('CHAT', 'REACTION', 'FLASH_POLL', 'SYSTEM')),
    content TEXT,
    embedded_poll_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Realtime broadcast trigger for events
-- (Not needed locally since supabase_realtime is FOR ALL TABLES)

-- RLS for live_room_events
ALTER TABLE public.live_room_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read live_room_events" ON public.live_room_events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert live_room_events" ON public.live_room_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. User-Generated Flash Polls
CREATE TABLE IF NOT EXISTS public.live_user_polls (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES public.matches(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    duration_seconds INTEGER DEFAULT 60 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL
);

-- RLS for live_user_polls
ALTER TABLE public.live_user_polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read live_user_polls" ON public.live_user_polls FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create live_user_polls" ON public.live_user_polls FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- 3. Flash Poll Votes (1-Tap Voting)
CREATE TABLE IF NOT EXISTS public.live_user_poll_votes (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER REFERENCES public.live_user_polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    option_idx INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(poll_id, user_id)
);

-- RLS for live_user_poll_votes
ALTER TABLE public.live_user_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read live_user_poll_votes" ON public.live_user_poll_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote in live_user_polls" ON public.live_user_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
