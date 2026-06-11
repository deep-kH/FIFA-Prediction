const { Client } = require('pg');

const connectionString = 'postgresql://postgres.jcmzwsctdihvmrudxnke:L6QcQn92Nw5mEtJ3@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    console.log('Deleting mock user from auth.users...');
    const res = await client.query(`
      DELETE FROM auth.users WHERE email = 'admin@example.com';
    `);
    
    console.log('Deleted rows:', res.rowCount);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
