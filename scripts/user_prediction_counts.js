const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Use the production keys with service role to bypass RLS
const supabaseUrl = 'https://jcmzwsctdihvmrudxnke.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbXp3c2N0ZGlodm1ydWR4bmtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE5MzEyNCwiZXhwIjoyMDk2NzY5MTI0fQ.kQALGdYRTNTdQJtoCvPfauDrBl4iIeYt2F1mI9ncvdo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getPredictionCounts() {
  console.log('Fetching users and their prediction counts...');
  
  // Fetch all profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name');

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return;
  }

  // Fetch all ballots (predictions)
  const { data: ballots, error: ballotsError } = await supabase
    .from('ballots')
    .select('user_id');

  if (ballotsError) {
    console.error('Error fetching ballots:', ballotsError);
    return;
  }

  // Calculate counts
  const userCounts = profiles.map(profile => {
    const count = ballots.filter(b => b.user_id === profile.id).length;
    return {
      name: profile.display_name,
      predictions: count
    };
  });

  // Sort by number of predictions descending
  userCounts.sort((a, b) => b.predictions - a.predictions);

  console.table(userCounts);
}

getPredictionCounts();
