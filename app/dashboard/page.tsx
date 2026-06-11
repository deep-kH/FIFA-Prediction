import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch current user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Fetch all upcoming and live matches with team details
  const { data: matches } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*),
      top_scorer:players(*),
      custom_polls(*)
    `)
    .order('kickoff_time', { ascending: true })

  // Fetch leaderboard (all profiles sorted by points)
  const { data: leaderboard } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_letter, total_points, is_admin')
    .order('total_points', { ascending: false })

  // Fetch ballots (RLS ensures user only gets their own for upcoming matches, but ALL for locked matches)
  const { data: ballots } = await supabase
    .from('ballots')
    .select('*, profiles(id, display_name, avatar_letter)')

  // Fetch poll answers (RLS identical to ballots)
  const { data: pollAnswers } = await supabase
    .from('poll_answers')
    .select('*, profiles(id, display_name, avatar_letter)')

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
