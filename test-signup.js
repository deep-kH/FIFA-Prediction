const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jcmzwsctdihvmrudxnke.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbXp3c2N0ZGlobm1ydWR4bmtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTYwNzMzOTUsImV4cCI6MjAzMTY0OTM5NX0.f'; // Wait, I don't have the full anon key. I have to read it from .env.local

const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/);
const key = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, key);

async function main() {
  console.log('Attempting sign up via Supabase Client...');
  const { data, error } = await supabase.auth.signUp({
    email: 'admin@example.com',
    password: 'securepassword123',
  });

  if (error) {
    console.error('❌ Sign Up Error:', error);
  } else {
    console.log('✅ Sign Up Success:', data);
  }
}

main();
