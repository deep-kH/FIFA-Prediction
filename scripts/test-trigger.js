const { Client } = require('pg');


const connectionString = 'postgresql://postgres.jcmzwsctdihvmrudxnke:L6QcQn92Nw5mEtJ3@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    console.log('Inserting into auth.users...');
    const res = await client.query(`
      INSERT INTO auth.users (
        id, email, raw_user_meta_data, aud, role, encrypted_password, 
        created_at, updated_at, confirmation_token, email_confirmed_at
      ) VALUES (
        gen_random_uuid(), 'admin@example.com', '{}', 'authenticated', 'authenticated', 'fakepassword',
        now(), now(), '', now()
      ) RETURNING *;
    `);
    
    console.log('Success:', res.rows[0]);
  } catch (err) {
    console.error('Trigger Error Details:');
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
