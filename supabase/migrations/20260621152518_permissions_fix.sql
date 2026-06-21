-- Grant usage on the public schema to the default roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant select, insert, update, delete on all tables in public to the default roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Grant usage on sequences so they can insert and increment IDs
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
