import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 3600 // Cache for 1 hour to save Supabase reads

export const alt = 'TACT-IX Live Arena'
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

    const baseUrl = 'https://tact-11-jade.vercel.app'
    const logoData = await fetch(`${baseUrl}/favicon.ico`).then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch logo: ${res.statusText}`)
      return res.arrayBuffer()
    })

    return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #2b0b11 0%, #1a0508 100%)', // Red/Dark gradient for LIVE
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
          border: '4px solid #FF4560', // Red border for live
        }}
      >
        {/* TACT-IX Branding Top */}
        <div style={{ position: 'absolute', top: 40, display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src={logoData as any} width={64} height={64} style={{ borderRadius: '1px' }} />
          <div style={{
            background: '#FF4560',
            color: '#fff',
            padding: '10px 24px',
            borderRadius: '12px',
            fontWeight: 'bold',
            fontSize: 28,
            letterSpacing: '2px'
          }}>
            TACT-IX
          </div>
          <span style={{ color: '#666', fontSize: 28 }}>|</span>
          <span style={{ color: '#FF4560', fontSize: 26, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#FF4560' }} />
            LIVE ARENA
          </span>
        </div>

        {/* Match Info */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '900px' }}>
            {/* Home Team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '350px' }}>
              <span style={{ fontSize: 130, marginBottom: 20 }}>{match.home_team?.flag_emoji}</span>
              <span style={{ fontSize: 46, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>{match.home_team?.name}</span>
            </div>

            {/* VS */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: 64, color: '#FF4560', fontWeight: 900, fontStyle: 'italic' }}>VS</span>
            </div>

            {/* Away Team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '350px' }}>
              <span style={{ fontSize: 130, marginBottom: 20 }}>{match.away_team?.flag_emoji}</span>
              <span style={{ fontSize: 46, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>{match.away_team?.name}</span>
            </div>
          </div>
        </div>

        {/* Call to action Bottom */}
        <div style={{ position: 'absolute', bottom: 40, fontSize: 30, color: '#FF4560', fontWeight: 'bold', letterSpacing: '1px' }}>
          Drop into the arena! Flash Polls & Trash Talk inside.
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
