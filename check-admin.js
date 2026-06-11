const { Client } = require('pg');

const connectionString = 'postgresql://postgres.jcmzwsctdihvmrudxnke:L6QcQn92Nw5mEtJ3@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Check if the user has signed up
    const res = await client.query('SELECT * FROM public.profiles WHERE email = $1', ['admin@example.com']);
    
    if (res.rows.length > 0) {
      console.log('User admin@example.com found in profiles!');
      // Update to admin
      await client.query('UPDATE public.profiles SET is_admin = true WHERE email = $1', ['admin@example.com']);
      console.log('✅ Successfully set is_admin = true for admin@example.com');
    } else {
      console.log('❌ User admin@example.com has not signed up yet via the frontend.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
