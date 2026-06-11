const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: Missing SUPABASE_SERVICE_ROLE_KEY in environment.');
  console.error('You need to add SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> to .env.local');
  console.error('Find it in Supabase Dashboard > Project Settings > API > service_role key');
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(__dirname, 'supabase', 'migrations', '0001_settlement_functions.sql'),
  'utf8'
);

const supabase = createClient(supabaseUrl, serviceKey, {
  db: { schema: 'public' }
});

async function run() {
  console.log('Pushing migration to Supabase...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_text: sql });
  if (error) {
    console.error('RPC exec_sql failed (expected if not set up). Use SQL Editor instead.');
    console.error(error.message);
    console.log('\n=== COPY THE SQL BELOW INTO SUPABASE SQL EDITOR ===\n');
    console.log(sql);
  } else {
    console.log('Migration applied successfully!');
  }
}

run();
