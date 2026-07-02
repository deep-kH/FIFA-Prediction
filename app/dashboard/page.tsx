import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  console.log('DASHBOARD PAGE: Fetching user:', user?.id)

  // Fetch current user's profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  console.log('DASHBOARD PAGE: Profile found:', !!profile, 'Error:', profileError)

  if (!profile) redirect('/login')

  // Fetch all upcoming and live matches with team details for match >= 87
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*),
      top_scorer:players(*),
      custom_polls(*)
    `)
    .gte('id', 87)
    .order('kickoff_time', { ascending: true })

  // Fetch leaderboard (all profiles sorted by points)
  const { data: leaderboard } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_letter, total_points, is_admin, current_streak')
    .order('total_points', { ascending: false })
    .limit(10000)

  // Helper function to fetch all rows across pagination limits
  async function fetchAll(table: string, select: string) {
    let allData: any[] = []
    let from = 0
    const step = 1000
    while (true) {
      const { data } = await supabase.from(table).select(select).range(from, from + step - 1)
      if (!data || data.length === 0) break
      allData = allData.concat(data)
      if (data.length < step) break
      from += step
    }
    return allData
  }

  // Fetch ballots and poll answers using pagination to bypass the 1000 row server limit
  const ballots = await fetchAll('ballots', '*, profiles(id, display_name, avatar_letter)')
  const pollAnswers = await fetchAll('poll_answers', '*, profiles(id, display_name, avatar_letter)')

  return (
    <DashboardClient
      profile={profile}
      matches={matches || []}
      leaderboard={leaderboard || []}
      userBallots={ballots || []}
      userPollAnswers={pollAnswers || []}
    />
  )
}
