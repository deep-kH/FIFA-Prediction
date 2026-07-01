import { ImageResponse } from 'next/og'

export const revalidate = 86400 // Cache for 24 hours (global preview rarely changes)

export const alt = 'TACT-IX - FIFA World Cup 2026 Prediction Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tact-11-jade.vercel.app'

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
          {/* Main Content */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              marginBottom: '32px'
            }}>
              <div style={{
                background: '#F5C842',
                color: '#0A0C10',
                padding: '16px 36px',
                borderRadius: '16px',
                fontWeight: '900',
                fontSize: 64,
                letterSpacing: '4px'
              }}>
                TACT-IX
              </div>
            </div>

            <div style={{ fontSize: 42, color: '#FFFFFF', fontWeight: 'bold', marginBottom: '16px', letterSpacing: '2px' }}>
              FIFA World Cup 2026 Prediction
            </div>
            
            <div style={{ fontSize: 28, color: '#888', fontWeight: 'normal', letterSpacing: '1px' }}>
              The private prediction platform for your circle.
            </div>
          </div>

          {/* Call to action Bottom */}
          <div style={{ position: 'absolute', bottom: 40, display: 'flex', gap: '30px', fontSize: 24, color: '#F5C842', fontWeight: 'bold', letterSpacing: '1px' }}>
            <span>⚽ Predict Scores</span>
            <span style={{ color: '#666' }}>•</span>
            <span>🏆 Climb the Leaderboard</span>
            <span style={{ color: '#666' }}>•</span>
            <span>🃏 Play Wildcards</span>
          </div>
        </div>
      ),
      { ...size }
    )
  } catch (err: any) {
    return new ImageResponse(
      (
        <div style={{ background: '#0A0C10', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <h1 style={{ color: '#ff4444', fontSize: 40, fontFamily: 'sans-serif' }}>TACT-IX</h1>
        </div>
      ),
      { ...size }
    )
  }
}
