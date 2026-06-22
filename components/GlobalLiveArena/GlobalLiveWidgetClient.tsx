'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'
import LiveArenaClient from './LiveArenaClient'
import { MessageSquare, X } from 'lucide-react'

interface Props {
  profile: Profile
  initialMatches: any[]
}

export default function GlobalLiveWidgetClient({ profile, initialMatches }: Props) {
  const [matches, setMatches] = useState<any[]>(initialMatches)
  const [isOpen, setIsOpen] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(initialMatches.length > 0 ? initialMatches[0].id : null)
  const [pulsing, setPulsing] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastRead, setLastRead] = useState<number>(0)
  const supabase = createClient()

  useEffect(() => {
    const saved = localStorage.getItem('tactix_global_chat_read')
    if (saved) {
      setLastRead(parseInt(saved))
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      const now = Date.now()
      setLastRead(now)
      localStorage.setItem('tactix_global_chat_read', now.toString())
    }
  }, [isOpen])

  useEffect(() => {
    // Poll for match updates every 60s in case a match kicks off or closes
    const checkLiveMatches = async () => {
      const { data } = await supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .eq('is_completed', false)
        .lte('kickoff_time', new Date().toISOString())
        .order('kickoff_time', { ascending: false })

      if (data) {
        const live = data.filter(m => {
          const mins = (Date.now() - new Date(m.kickoff_time).getTime()) / (1000 * 60)
          return mins < 150
        })
        setMatches(live)
        if (live.length === 1 && !selectedMatchId) {
          setSelectedMatchId(live[0].id)
        }
      }
    }

    const interval = setInterval(checkLiveMatches, 60000)
    return () => clearInterval(interval)
  }, [supabase, selectedMatchId])

  useEffect(() => {
    // Subscribe to global events for badge and pulse
    const channel = supabase.channel(`global_events_badge`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_room_events' }, (payload) => {
        const event = payload.new as any
        
        if (!isOpen) {
          setUnreadCount(prev => prev + 1)
          if (event.event_type === 'POLL_DROP') {
            setPulsing(true)
            setTimeout(() => setPulsing(false), 10000) // pulse for 10s
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isOpen, supabase])

  // Also check URL parameters to see if we should auto-open a specific match
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const liveParam = urlParams.get('live')
    if (liveParam) {
      const mId = parseInt(liveParam)
      if (matches.some(m => m.id === mId)) {
        setSelectedMatchId(mId)
        setIsOpen(true)
      }
    }
  }, [matches])

  const activeMatch = matches.length > 0 ? (matches.find(m => m.id === selectedMatchId) || matches[0]) : null

  return (
    <>
      {!isOpen && (
        <div 
          onClick={() => setIsOpen(true)}
          className={`global-live-widget-btn ${pulsing ? 'pulse-anim' : ''}`}
          style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
            background: 'var(--cup-red)', color: '#fff', padding: '12px 20px',
            borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,69,96,0.4)',
            fontWeight: 800, fontSize: '14px', transition: 'transform 0.2s'
          }}
        >
          {unreadCount > 0 && (
            <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ff0000', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              {unreadCount}
            </div>
          )}
          {activeMatch && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />}
          <span>
            {!activeMatch 
              ? 'Global Arena'
              : `${activeMatch.home_team?.name} vs ${activeMatch.away_team?.name}`}
          </span>
          <MessageSquare size={18} style={{ marginLeft: '4px' }} />
        </div>
      )}

      {isOpen && (
        <div 
          className="global-live-widget-container"
          style={{
            position: 'fixed',
            bottom: isFullScreen ? '0' : '24px',
            right: isFullScreen ? '0' : '24px',
            width: isFullScreen ? '100%' : '380px',
            height: isFullScreen ? '100%' : '600px',
            maxWidth: '100%',
            maxHeight: isFullScreen ? '100%' : 'calc(100vh - 48px)',
            background: 'var(--surface-base)',
            borderRadius: isFullScreen ? '0' : '16px',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            border: isFullScreen ? 'none' : '1px solid var(--border-default)'
          }}
        >
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <LiveArenaClient 
              match={activeMatch} 
              profile={profile} 
              isWidget={true}
              onClose={() => setIsOpen(false)}
              onExpand={() => setIsFullScreen(!isFullScreen)}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        .global-live-widget-btn:hover { transform: scale(1.05); }
        .pulse-anim { animation: severePulse 1.5s infinite; box-shadow: 0 0 20px rgba(255,69,96,0.8) !important; }
        @keyframes severePulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,69,96,0.7); }
          50% { transform: scale(1.08); box-shadow: 0 0 0 10px rgba(255,69,96,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,69,96,0); }
        }
        @media (max-width: 768px) {
          .global-live-widget-container {
            width: 100% !important;
            height: 100% !important;
            bottom: 0 !important;
            right: 0 !important;
            border-radius: 0 !important;
            max-height: 100dvh !important;
          }
        }
      `}</style>
    </>
  )
}
