const { Client } = require('pg');

const connectionString = 'postgresql://postgres.jcmzwsctdihvmrudxnke:L6QcQn92Nw5mEtJ3@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Simulate what the trigger does
    console.log('Testing trigger logic...');
    
    const query = `
      DO $$
      DECLARE
        new_email text := 'admin@example.com';
        new_id uuid := gen_random_uuid();
        new_raw_user_meta_data jsonb := NULL; -- Simulating what GoTrue might send
        v_display_name text;
        v_avatar_letter text;
      BEGIN
        if not exists (
          select 1 from public.allowed_friends where email = new_email
        ) then
          raise exception 'NOT_WHITELISTED: % is not authorized to join this hub.', new_email;
        end if;

        v_display_name := coalesce(
          new_raw_user_meta_data->>'full_name',
          new_raw_user_meta_data->>'name',
          split_part(new_email, '@', 1)
        );

        v_avatar_letter := upper(left(v_display_name, 1));

        insert into public.profiles (id, email, display_name, avatar_letter)
        values (new_id, new_email, v_display_name, v_avatar_letter);
        
        -- Rollback so we don't pollute the db
        RAISE EXCEPTION 'TEST_SUCCESS';
      END;
      $$;
    `;
    
    await client.query(query);
    
  } catch (err) {
    if (err.message.includes('TEST_SUCCESS')) {
      console.log('✅ Trigger logic works perfectly. No syntax or null-handling errors.');
    } else {
      console.error('❌ Trigger logic failed:', err.message);
    }
  } finally {
    await client.end();
  }
}

main();
