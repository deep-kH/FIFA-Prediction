-- =============================================
-- BentoKick Fantasy Engine — Remove Allowed Friends Whitelist
-- Run this in Supabase SQL Editor
-- =============================================

-- Replaces the handle_new_user trigger to allow ANYONE to sign up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_display_name text;
  v_avatar_letter text;
begin
  -- Check if email is whitelisted (REMOVED)
  -- Anyone can now sign up!
  
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
