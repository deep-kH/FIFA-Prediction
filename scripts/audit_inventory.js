const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or URL in .env.production");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching data from Supabase...");

  // Fetch all completed matches ordered by kickoff time
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, kickoff_time, is_completed')
    .eq('is_completed', true)
    .order('kickoff_time', { ascending: true });

  if (matchErr) throw matchErr;

  // Fetch all ballots
  let allBallots = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data: bData, error: bErr } = await supabase
      .from('ballots')
      .select('id, user_id, match_id, played_card, accuracy_rate')
      .range(from, from + step - 1);
    
    if (bErr) throw bErr;
    if (!bData || bData.length === 0) break;
    allBallots = allBallots.concat(bData);
    if (bData.length < step) break;
    from += step;
  }

  // Fetch all profiles
  let allProfiles = [];
  from = 0;
  while (true) {
    const { data: pData, error: pErr } = await supabase
      .from('profiles')
      .select('id, display_name, inventory_multiplier, inventory_safety, current_streak')
      .range(from, from + step - 1);
    
    if (pErr) throw pErr;
    if (!pData || pData.length === 0) break;
    allProfiles = allProfiles.concat(pData);
    if (pData.length < step) break;
    from += step;
  }

  console.log(`Fetched ${matches.length} matches, ${allBallots.length} ballots, ${allProfiles.length} profiles.`);

  // Map matches to their order
  const matchOrder = matches.map(m => m.id);

  const discrepancies = [];

  for (const profile of allProfiles) {
    let earnedMultiplier = 0;
    let earnedSafety = 0;
    let usedMultiplier = 0;
    let usedSafety = 0;
    let currentStreak = 0;

    // Filter ballots for this user
    const userBallots = allBallots.filter(b => b.user_id === profile.id);

    // Sort user ballots by the chronological order of the matches
    userBallots.sort((a, b) => {
      const idxA = matchOrder.indexOf(a.match_id);
      const idxB = matchOrder.indexOf(b.match_id);
      if (idxA === -1 || idxB === -1) return 0; // Ignore uncompleted matches
      return idxA - idxB;
    });

    for (const ballot of userBallots) {
      // Check if match is completed
      if (!matchOrder.includes(ballot.match_id)) continue;

      // Track usage
      if (ballot.played_card === 'MULTIPLIER') usedMultiplier++;
      if (ballot.played_card === 'SAFETY_NET') usedSafety++;

      // Track earnings (Halal Ball / Multiplier) based on streak
      if (ballot.accuracy_rate >= 25) {
        currentStreak++;
      } else {
        if (ballot.played_card !== 'SAFETY_NET') {
          currentStreak = 0;
        }
      }

      if (currentStreak > 0 && currentStreak % 5 === 0 && ballot.accuracy_rate >= 25) {
        earnedMultiplier++;
      }

      // Track earnings (Haram Ball / Safety) based on 100% accuracy
      if (ballot.accuracy_rate === 100) {
        earnedSafety++;
      }
    }

    const expectedMultiplier = earnedMultiplier - usedMultiplier;
    const expectedSafety = earnedSafety - usedSafety;

    const multiplierMatch = expectedMultiplier === profile.inventory_multiplier;
    const safetyMatch = expectedSafety === profile.inventory_safety;
    const streakMatch = currentStreak === profile.current_streak;

    if (!multiplierMatch || !safetyMatch || !streakMatch) {
      discrepancies.push({
        display_name: profile.display_name,
        actual_inventory: { mult: profile.inventory_multiplier, safe: profile.inventory_safety, streak: profile.current_streak },
        expected_inventory: { mult: expectedMultiplier, safe: expectedSafety, streak: currentStreak },
        stats: { earned_mult: earnedMultiplier, used_mult: usedMultiplier, earned_safe: earnedSafety, used_safe: usedSafety }
      });
    }
  }

  if (discrepancies.length === 0) {
    console.log("✅ All user inventories tally perfectly with their match history!");
  } else {
    console.log("❌ Found discrepancies for the following users:");
    console.table(discrepancies.map(d => ({
      User: d.display_name,
      'Actual (Mult/Safe/Streak)': `${d.actual_inventory.mult} / ${d.actual_inventory.safe} / ${d.actual_inventory.streak}`,
      'Expected (Mult/Safe/Streak)': `${d.expected_inventory.mult} / ${d.expected_inventory.safe} / ${d.expected_inventory.streak}`,
      'Used (Mult/Safe)': `${d.stats.used_mult} / ${d.stats.used_safe}`
    })));
  }
}

main().catch(console.error);
