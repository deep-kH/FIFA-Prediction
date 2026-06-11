const { Client } = require('pg');

const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-southeast-2',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'ca-central-1',
  'sa-east-1'
];

const projectRef = 'jcmzwsctdihvmrudxnke';
const password = 'L6QcQn92Nw5mEtJ3';

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/postgres`;
  
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT 1');
    console.log(`✅ SUCCESS: Connected to region: ${region}`);
    await client.end();
    return true;
  } catch (err) {
    if (!err.message.includes('tenant/user') && !err.message.includes('ENOTFOUND')) {
      console.log(`❓ INTERESTING ERROR in ${region}:`, err.message);
    }
    // Tenant/user not found means this region is not the owner
    return false;
  }
}

async function main() {
  console.log('Testing regions...');
  for (const region of regions) {
    const success = await testRegion(region);
    if (success) {
      console.log(`\n🎉 Found matching region: ${region}`);
      process.exit(0);
    }
  }
  console.log('\n❌ Done testing all regions. No matching region found.');
}

main();
