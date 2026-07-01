const { createClient } = require('@supabase/supabase-js');

// Use the production keys with service role to bypass RLS
const supabaseUrl = 'https://jcmzwsctdihvmrudxnke.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbXp3c2N0ZGlodm1ydWR4bmtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE5MzEyNCwiZXhwIjoyMDk2NzY5MTI0fQ.kQALGdYRTNTdQJtoCvPfauDrBl4iIeYt2F1mI9ncvdo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, display_name, total_points, baseline_points')
    .limit(10);
  
  if (error) console.error(error);
  else console.table(profiles);
}

check();
