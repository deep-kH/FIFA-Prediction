-- =============================================
-- BentoKick Fantasy Engine — Complete Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- 0. ENABLE REQUIRED EXTENSIONS
create extension if not exists "uuid-ossp";

-- =============================================
-- 1. TABLES
-- =============================================

-- Whitelist of allowed friends
create table if not exists public.allowed_friends (
  email        text primary key,
  added_at     timestamptz default now() not null
);

-- User profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  display_name  text not null,
  avatar_letter text not null,
  total_points  integer default 0 not null,
  is_admin      boolean default false not null,
  created_at    timestamptz default now() not null
);

-- National teams
create table if not exists public.teams (
  id           serial primary key,
  name         text unique not null,
  flag_emoji   text not null default '🏴',
  group_letter text
);

-- Players belonging to teams
create table if not exists public.players (
  id       serial primary key,
  name     text not null,
  team_id  integer references public.teams(id) on delete cascade not null,
  position text default 'Forward'
);

-- Match schedule
create table if not exists public.matches (
  id              serial primary key,
  home_team_id    integer references public.teams(id) not null,
  away_team_id    integer references public.teams(id) not null,
  kickoff_time    timestamptz not null,
  stage           text not null default 'Group',
  home_score      integer,
  away_score      integer,
  top_scorer_id   integer references public.players(id),
  is_completed    boolean default false not null,
  created_at      timestamptz default now() not null
);

-- Custom admin-created MCQ polls per match
create table if not exists public.custom_polls (
  id              serial primary key,
  match_id        integer references public.matches(id) on delete cascade not null,
  question        text not null,
  option_a        text not null,
  option_b        text not null,
  option_c        text not null,
  option_d        text not null,
  correct_option  char(1) check (correct_option in ('A','B','C','D'))
);

-- User prediction ballots per match
create table if not exists public.ballots (
  id                       serial primary key,
  user_id                  uuid references public.profiles(id) on delete cascade not null,
  match_id                 integer references public.matches(id) on delete cascade not null,
  predicted_home_score     integer check (predicted_home_score >= 0),
  predicted_away_score     integer check (predicted_away_score >= 0),
  predicted_top_scorer_id  integer references public.players(id),
  points_earned            integer default 0 not null,
  created_at               timestamptz default now() not null,
  unique(user_id, match_id)
);

-- User answers to custom MCQ polls
create table if not exists public.poll_answers (
  id              serial primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  poll_id         integer references public.custom_polls(id) on delete cascade not null,
  selected_option char(1) not null check (selected_option in ('A','B','C','D')),
  points_earned   integer default 0 not null,
  unique(user_id, poll_id)
);

-- =============================================
-- 2. AUTH TRIGGER — WHITELIST GATE
-- =============================================

-- Function: Check whitelist and create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_display_name text;
  v_avatar_letter text;
begin
  -- Check if email is whitelisted
  if not exists (
    select 1 from public.allowed_friends where email = new.email
  ) then
    raise exception 'NOT_WHITELISTED: % is not authorized to join this hub.', new.email;
  end if;

  -- Derive display name from email or metadata
  v_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  -- Avatar letter from first character of display name
  v_avatar_letter := upper(left(v_display_name, 1));

  -- Insert into profiles
  insert into public.profiles (id, email, display_name, avatar_letter)
  values (new.id, new.email, v_display_name, v_avatar_letter);

  return new;
end;
$$;

-- Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- 3. ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
alter table public.allowed_friends enable row level security;
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.custom_polls enable row level security;
alter table public.ballots enable row level security;
alter table public.poll_answers enable row level security;

-- allowed_friends: only admins can manage; no one can read directly from client
create policy "Admin full access on allowed_friends"
  on public.allowed_friends for all
  using ((select is_admin from public.profiles where id = auth.uid()));

-- profiles: users see all profiles; can only update own
create policy "Anyone can read profiles"
  on public.profiles for select using (auth.uid() is not null);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Admin can update all profiles"
  on public.profiles for update
  using ((select is_admin from public.profiles where id = auth.uid()));

-- teams: all authenticated users can read; only admin can write
create policy "Read teams"
  on public.teams for select using (auth.uid() is not null);

create policy "Admin manage teams"
  on public.teams for all
  using ((select is_admin from public.profiles where id = auth.uid()));

-- players: all authenticated users can read; only admin can write
create policy "Read players"
  on public.players for select using (auth.uid() is not null);

create policy "Admin manage players"
  on public.players for all
  using ((select is_admin from public.profiles where id = auth.uid()));

-- matches: all authenticated users can read; only admin can write
create policy "Read matches"
  on public.matches for select using (auth.uid() is not null);

create policy "Admin manage matches"
  on public.matches for all
  using ((select is_admin from public.profiles where id = auth.uid()));

-- custom_polls: all authenticated users can read; only admin can write
create policy "Read polls"
  on public.custom_polls for select using (auth.uid() is not null);

create policy "Admin manage polls"
  on public.custom_polls for all
  using ((select is_admin from public.profiles where id = auth.uid()));

-- ballots:
-- - Before kickoff: users can only see their own ballot
-- - After kickoff: all authenticated users can see all ballots
create policy "Users manage own ballot"
  on public.ballots for all using (auth.uid() = user_id);

create policy "Friends see all ballots after kickoff"
  on public.ballots for select
  using (
    auth.uid() is not null and
    exists (
      select 1 from public.matches m
      where m.id = match_id and now() >= m.kickoff_time
    )
  );

-- poll_answers:
create policy "Users manage own poll answers"
  on public.poll_answers for all using (auth.uid() = user_id);

create policy "Friends see all poll answers after kickoff"
  on public.poll_answers for select
  using (
    auth.uid() is not null and
    exists (
      select 1 from public.custom_polls cp
      join public.matches m on m.id = cp.match_id
      where cp.id = poll_id and now() >= m.kickoff_time
    )
  );

-- =============================================
-- 4. SEED DATA — FIFA 2026 PARTICIPATING TEAMS
-- (Partial — add full 48 teams as needed)
-- =============================================

insert into public.allowed_friends (email) values
  ('admin@example.com')
on conflict do nothing;
