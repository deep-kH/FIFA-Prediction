import { createClient } from '@/utils/supabase/server'
import GlobalLiveWidgetClient from './GlobalLiveWidgetClient'

export default async function GlobalLiveWidgetWrapper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) return null

  // We fetch initial active matches
  // Active means kickoff_time has passed, but is_completed is false AND within 150 minutes of kickoff
  // The client side can also handle its own subscriptions if necessary, but server initial load is good.
  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('is_completed', false)
    .lte('kickoff_time', new Date().toISOString())
    .order('kickoff_time', { ascending: false })

  const liveMatches = matches?.filter(m => {
    const minutesSinceKickoff = (Date.now() - new Date(m.kickoff_time).getTime()) / (1000 * 60)
    return minutesSinceKickoff < 150
  }) || []

  return <GlobalLiveWidgetClient profile={profile} initialMatches={liveMatches} />
}
