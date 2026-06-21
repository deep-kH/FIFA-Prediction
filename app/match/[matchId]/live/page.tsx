import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LiveArenaClient from './LiveArenaClient'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ matchId: string }> }): Promise<Metadata> {
  const { matchId } = await params
  const supabase = await createClient()
  const { data: match } = await supabase.from('matches').select('home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)').eq('id', matchId).single()
  
  if (!match) return { title: 'Live Arena | TACT-IX' }
  
  const title = `🔴 LIVE: ${(match.home_team as any)?.name} vs ${(match.away_team as any)?.name} | TACT-IX Arena`
  const description = 'Join the live prediction arena. React in real-time, vote on flash polls, and see the swings!'
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    }
  }
}

export default async function LiveArenaPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: match } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*)
    `)
    .eq('id', matchId)
    .single()

  if (!match) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#fff' }}>Match not found.</div>
  }

  return (
    <LiveArenaClient 
      match={match}
      profile={profile}
    />
  )
}
