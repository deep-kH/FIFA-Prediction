const { Client } = require('pg');

const connectionString = 'postgresql://postgres.jcmzwsctdihvmrudxnke:L6QcQn92Nw5mEtJ3@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // Check allowed_friends table
    const res = await client.query('SELECT * FROM public.allowed_friends');
    console.log('Allowed Friends:', res.rows);
    
    // Check if the function exists
    const funcRes = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' AND routine_name = 'check_whitelist';
    `);
    console.log('Function exists:', funcRes.rows.length > 0);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
