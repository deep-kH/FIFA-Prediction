const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jcmzwsctdihvmrudxnke.supabase.co';
const supabaseKey = 'sb_publishable_iiDvCK3GryyHblYD8xxjmQ_6eD2NI_r';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('id', 29)
    .single();
  
  console.log('Error:', error);
  console.log('Data:', data);
}

test();
