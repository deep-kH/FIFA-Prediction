const { createClient } = require('@supabase/supabase-js');

// Use the production keys with service role to bypass RLS
const supabaseUrl = 'https://jcmzwsctdihvmrudxnke.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbXp3c2N0ZGlodm1ydWR4bmtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE5MzEyNCwiZXhwIjoyMDk2NzY5MTI0fQ.kQALGdYRTNTdQJtoCvPfauDrBl4iIeYt2F1mI9ncvdo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixLeaderboard() {
  console.log('Fetching profiles...');
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, total_points, baseline_points');
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  // Set baseline_points = total_points + baseline_points (in case they already had some baseline, though currently 0)
  console.log('Setting baseline_points for each user...');
  for (const profile of profiles) {
    // Their actual points earned up to now is total_points + baseline_points
    // Since total_points is what they have now (e.g. 38) and baseline is 0
    const newBaseline = Number(profile.total_points) + Number(profile.baseline_points || 0);
    
    await supabase
      .from('profiles')
      .update({ baseline_points: newBaseline })
      .eq('id', profile.id);
  }

  console.log('Baseline points updated! Now resetting total_points to 0...');
  
  // Now we need to recalculate total_points. Since we can't call recalculate_leaderboard directly from here easily 
  // without RPC, we can just set total_points to 0 manually.
  for (const profile of profiles) {
    await supabase
      .from('profiles')
      .update({ total_points: 0 })
      .eq('id', profile.id);
  }

  console.log('Done! Leaderboard reset.');
}

fixLeaderboard();
