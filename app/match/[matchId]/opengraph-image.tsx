import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 3600 // Cache for 1 hour to save Supabase reads

export const alt = 'TACT-IX Match Preview'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId } = await params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in environment variables!')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch match details
    const { data: match, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('id', matchId)
    .single()

  if (!match) {
    return new ImageResponse(
      (
        <div style={{ background: '#0A0C10', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ color: 'white', fontSize: 60, fontFamily: 'sans-serif' }}>Match Not Found</h1>
        </div>
      ),
      { ...size }
    )
  }

  const kickoff = new Date(match.kickoff_time)
  const formattedDate = kickoff.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })
  const formattedTime = kickoff.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })

    // Load the logo using Next.js native Edge bundling.
    // This avoids an HTTP network request and loads instantly from memory!
    const logoData = await fetch(new URL('../../favicon.ico', import.meta.url)).then((res) => res.arrayBuffer())

    return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0A0C10 0%, #1a1c23 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
          border: '4px solid #F5C842', // TACT-IX gold border
        }}
      >
        {/* TACT-IX Branding Top */}
        <div style={{ position: 'absolute', top: 40, display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src={logoData as any} width={64} height={64} style={{ borderRadius: '1px' }} />
          <div style={{
            background: '#F5C842',
            color: '#0A0C10',
            padding: '10px 24px',
            borderRadius: '12px',
            fontWeight: 'bold',
            fontSize: 28,
            letterSpacing: '2px'
          }}>
            TACT-IX
          </div>
          <span style={{ color: '#666', fontSize: 28 }}>|</span>
          <span style={{ color: '#ccc', fontSize: 26, fontWeight: 'bold' }}>FIFA World Cup 2026 Prediction</span>
        </div>

        {/* Match Info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
          <div style={{ fontSize: 32, color: '#888', marginBottom: 50, textTransform: 'uppercase', letterSpacing: '4px', fontWeight: 'bold', display: 'flex' }}>
            {`${match.stage || 'Group Stage'} • ${formattedDate} ${formattedTime} IST`}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '900px' }}>
            {/* Home Team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '350px' }}>
              <span style={{ fontSize: 130, marginBottom: 20 }}>{match.home_team?.flag_emoji}</span>
              <span style={{ fontSize: 46, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>{match.home_team?.name}</span>
            </div>

            {/* VS */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 64, color: '#F5C842', fontWeight: 900, fontStyle: 'italic' }}>VS</span>
            </div>

            {/* Away Team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '350px' }}>
              <span style={{ fontSize: 130, marginBottom: 20 }}>{match.away_team?.flag_emoji}</span>
              <span style={{ fontSize: 46, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>{match.away_team?.name}</span>
            </div>
          </div>
        </div>

        {/* Call to action Bottom */}
        <div style={{ position: 'absolute', bottom: 40, fontSize: 30, color: '#F5C842', fontWeight: 'bold', letterSpacing: '1px' }}>
          Predict the exact scoreline & win points!
        </div>
      </div>
      ),
      { ...size }
    )
  } catch (err: any) {
    return new ImageResponse(
      (
        <div style={{ background: '#0A0C10', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <h1 style={{ color: '#ff4444', fontSize: 40, fontFamily: 'sans-serif' }}>Error: {err.message}</h1>
        </div>
      ),
      { ...size }
    )
  }
}
