'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function MatchRedirectPage() {
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    if (params.matchId) {
      router.replace(`/dashboard?matchId=${params.matchId}`)
    } else {
      router.replace('/dashboard')
    }
  }, [params.matchId, router])

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0A0C10' }}>
      <div style={{ textAlign: 'center', color: '#ccc', fontFamily: 'sans-serif' }}>
        <h2 style={{ fontSize: '24px' }}>Loading match details...</h2>
        <p style={{ marginTop: '8px', color: '#888' }}>Redirecting you to the dashboard...</p>
      </div>
    </div>
  )
}
