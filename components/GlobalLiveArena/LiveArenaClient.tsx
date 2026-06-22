'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'
import { Send, ArrowLeft, Heart, Zap, Flame, Clock, BarChart2, Plus, Loader2, X, Share2, Check } from 'lucide-react'
import Link from 'next/link'
import LiveGraphicsEngine from '@/components/LiveGraphicsEngine'

interface Props {
  match?: any
  profile: Profile
  isWidget?: boolean
  onClose?: () => void
  onExpand?: () => void
}

interface LiveEvent {
  id: number
  match_id: number
  user_id: string
  event_type: 'CHAT' | 'REACTION' | 'POLL_DROP'
  content: string | null
  embedded_poll_id: number | null
  created_at: string
  profiles?: Profile
}

interface FloatingEmoji {
  id: string
  emoji: string
  x: number
}

export default function LiveArenaClient({ match, profile, isWidget, onClose, onExpand }: Props) {
  const supabase = createClient()
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [chatInput, setChatInput] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  // Track multiple active polls simultaneously
  const [activePolls, setActivePolls] = useState<Record<number, any>>({})
  const [answeredPolls, setAnsweredPolls] = useState<Record<number, boolean>>({})
  const [pollVotesMap, setPollVotesMap] = useState<Record<number, any[]>>({})
  const [allPolls, setAllPolls] = useState<any[]>([])
  const [allPollVotes, setAllPollVotes] = useState<any[]>([])
  
  const pollMessageRefs = useRef<{[key: string]: HTMLDivElement | null}>({})
  
  const liveRoomChannelRef = useRef<any>(null)
  const [lastReaction, setLastReaction] = useState<string>('')
  
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [newPollQ, setNewPollQ] = useState('')
  const [newPollOptions, setNewPollOptions] = useState(['Yes', 'No', '', ''])
  const [newPollDuration, setNewPollDuration] = useState(60)
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  
  const eventsEndRef = useRef<HTMLDivElement>(null)

  const [pollTimeRemainingMap, setPollTimeRemainingMap] = useState<Record<number, number>>({})
  // Timer for all active polls
  useEffect(() => {
    const pollIds = Object.keys(activePolls).map(Number)
    if (pollIds.length === 0) return
    const interval = setInterval(() => {
      const now = Date.now()
      const updates: Record<number, number> = {}
      const expired: number[] = []
      for (const id of pollIds) {
        const poll = activePolls[id]
        const remaining = new Date(poll.closes_at).getTime() - now
        if (remaining <= 0) {
          expired.push(id)
          updates[id] = 0
        } else {
          updates[id] = remaining
        }
      }
      setPollTimeRemainingMap(prev => ({ ...prev, ...updates }))
      if (expired.length > 0) {
        setActivePolls(prev => {
          const next = { ...prev }
          expired.forEach(id => delete next[id])
          return next
        })
      }
    }, 100)
    return () => clearInterval(interval)
  }, [activePolls])
  
  const graphicsChannelRef = useRef<any>(null)

  // Fetch initial data and subscribe
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const { data: evtsDesc } = await supabase.from('live_room_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
          
        let evts = evtsDesc ? [...evtsDesc].reverse() : []
        
        if (evts.length > 0) {
          const userIds = Array.from(new Set(evts.map(e => e.user_id)))
          const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds)
          if (profilesData) {
            evts = evts.map(e => ({ ...e, profiles: profilesData.find(p => p.id === e.user_id) }))
          }
        }
        setEvents(evts)

        const { data: pastPolls } = await supabase.from('live_user_polls')
          .select('*, profiles:creator_id(*)')
          .order('created_at', { ascending: true })

        const pollIds = pastPolls && pastPolls.length > 0 ? pastPolls.map(p => p.id) : [0]
        const { data: pastVotes } = await supabase.from('live_user_poll_votes')
          .select('*, profiles(*)')
          .in('poll_id', pollIds)

        setAllPolls(pastPolls || [])
        setAllPollVotes(pastVotes || [])

        // See if there are any active polls (could be multiple)
        const { data: activeOpenPolls } = await supabase.from('live_user_polls')
          .select('*')
          .gt('closes_at', new Date().toISOString())
          .order('created_at', { ascending: false })
        
        if (activeOpenPolls && activeOpenPolls.length > 0) {
          const pollMap: Record<number, any> = {}
          const answeredMap: Record<number, boolean> = {}
          const votesMap: Record<number, any[]> = {}
          
          for (const poll of activeOpenPolls) {
            pollMap[poll.id] = poll
            const { data: existingVote } = await supabase.from('live_user_poll_votes')
              .select('*')
              .eq('poll_id', poll.id)
              .eq('user_id', profile.id)
              .maybeSingle()
            if (existingVote) answeredMap[poll.id] = true
            
            const { data: votes } = await supabase.from('live_user_poll_votes')
              .select('*')
              .eq('poll_id', poll.id)
            votesMap[poll.id] = votes || []
          }
          setActivePolls(pollMap)
          setAnsweredPolls(answeredMap)
          setPollVotesMap(votesMap)
        }
      } catch (err) {
        console.error(err)
      }
    }

    fetchInitial()

    const channel = supabase.channel(`global_live_room`, {
      config: { broadcast: { self: false } }
    })
      .on('broadcast', { event: 'reaction' }, (payload) => {
        const emoji = payload.payload?.emoji
        if (emoji) {
          setLastReaction(emoji + ':' + Math.random())
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_room_events' }, async (payload) => {
        const newEvent = payload.new as LiveEvent
        
        // Fetch profile info for the new event
        if (newEvent.user_id !== profile.id) {
          const { data: p } = await supabase.from('profiles').select('*').eq('id', newEvent.user_id).single()
          newEvent.profiles = p
        } else {
          newEvent.profiles = profile
        }
        
        setEvents(prev => [...prev, newEvent])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_user_polls' }, async (payload) => {
        const newPoll = payload.new as any
        const { data: creator } = await supabase.from('profiles').select('*').eq('id', newPoll.creator_id).single()
        newPoll.profiles = creator
        setAllPolls(prev => [...prev, newPoll])
        // Add to active polls map without replacing existing ones
        setActivePolls(prev => ({ ...prev, [newPoll.id]: newPoll }))
        setPollVotesMap(prev => ({ ...prev, [newPoll.id]: [] }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_user_poll_votes' }, async (payload) => {
        const newVote = payload.new as any
        const { data: voter } = await supabase.from('profiles').select('*').eq('id', newVote.user_id).single()
        newVote.profiles = voter
        setPollVotesMap(prev => ({
          ...prev,
          [newVote.poll_id]: [...(prev[newVote.poll_id] || []), newVote]
        }))
        setAllPollVotes(prev => [...prev, newVote])
      })
      
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        liveRoomChannelRef.current = channel
      }
    })

    // Setup Presence
    const presenceChannel = supabase.channel(`global_presence`)
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setOnlineCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user: profile.id })
        }
      })

    return () => { 
      supabase.removeChannel(channel)
      supabase.removeChannel(presenceChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to bottom when events change
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  // (Poll timer is handled by the single unified effect above)

  const sendReaction = async (emoji: string) => {
    setLastReaction(emoji + ':' + Math.random())
    if (liveRoomChannelRef.current) {
      liveRoomChannelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji, senderName: profile.display_name }
      })
    }
  }

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    const content = chatInput.trim()
    setChatInput('')

    await supabase.from('live_room_events').insert({
      match_id: null,
      user_id: profile.id,
      event_type: 'CHAT',
      content
    })
  }

  const dropPoll = async () => {
    if (!newPollQ.trim() || newPollOptions.filter(o => o.trim()).length < 2) return
    setCreatingPoll(true)
    const optionsArray = newPollOptions.filter(o => o.trim())
    const closesAt = new Date(Date.now() + newPollDuration * 1000).toISOString()
    
    const { data: poll } = await supabase.from('live_user_polls').insert({
      match_id: null,
      creator_id: profile.id,
      question: newPollQ,
      options: optionsArray,
      duration_seconds: newPollDuration,
      closes_at: closesAt
    }).select().single()

    if (poll) {
      await supabase.from('live_room_events').insert({
        match_id: null,
        user_id: profile.id,
        event_type: 'POLL_DROP',
        embedded_poll_id: poll.id,
        content: `Dropped a ${newPollDuration}s Flash Poll!`
      })
    }
    setShowCreatePoll(false)
    setCreatingPoll(false)
    setNewPollQ('')
    setNewPollOptions(['Yes', 'No', '', ''])
  }

  const answerPoll = async (pollId: number, optionIdx: number) => {
    if (answeredPolls[pollId]) return
    setAnsweredPolls(prev => ({ ...prev, [pollId]: true }))
    
    await supabase.from('live_user_poll_votes').insert({
      poll_id: pollId,
      user_id: profile.id,
      option_idx: optionIdx
    })
  }

  const shareMatchRoom = async () => {
    const url = `${window.location.origin}/dashboard`
    const isLive = match && new Date() >= new Date(match.kickoff_time) && !match.is_completed
    const textMsg = isLive 
      ? `hey, wanna join the trash talk. ${match.home_team?.name} vs ${match.away_team?.name} is live now.. ${url}?live=${match.id}`
      : `Join the Global Live Arena ${url}`
      
    try {
      if (navigator.share) {
        await navigator.share({ title: `TACT-IX Arena`, text: textMsg })
      } else {
        await navigator.clipboard.writeText(textMsg)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      }
    } catch {
      await navigator.clipboard.writeText(textMsg)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  return (
    <div className="arena-container">
      {match && <LiveGraphicsEngine matchId={match.id} trigger={lastReaction} />}
      {/* Header */}
      <header className="arena-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {!isWidget && (
            <Link href="/dashboard" className="btn btn-ghost btn-icon" style={{ marginRight: '8px' }}>
              <ArrowLeft size={20} />
            </Link>
          )}
          <div className="arena-match-info" style={{ margin: 0 }}>
            <span className="arena-pulse-dot" />
            {!isWidget && <span className="arena-title">LIVE ARENA</span>}
            <span className="arena-teams" style={{ fontSize: isWidget ? '14px' : '16px' }}>
              {match ? `${match.home_team?.flag_emoji} ${match.home_score} - ${match.away_score} ${match.away_team?.flag_emoji}` : 'GLOBAL ARENA'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '12px', fontSize: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff00' }} />
              {onlineCount} {onlineCount === 1 ? 'Player' : 'Players'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {profile.is_admin && (
            <button onClick={shareMatchRoom} className="btn btn-ghost btn-icon" title="Share match room" style={{ position: 'relative' }}>
              {linkCopied ? <Check size={16} color="#00ff00" /> : <Share2 size={16} />}
            </button>
          )}
          {isWidget && onExpand && (
            <button onClick={onExpand} className="btn btn-ghost btn-icon" title="Expand">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
          )}
          {isWidget && onClose && (
            <button onClick={onClose} className="btn btn-ghost btn-icon" title="Close">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {Object.keys(activePolls).length > 0 && (
          <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
            {Object.values(activePolls).map((poll: any) => (
              <div key={poll.id}
                onClick={() => pollMessageRefs.current[poll.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                style={{
                  background: 'var(--cup-red)', color: '#fff', padding: '5px 14px', borderRadius: '20px',
                  fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255, 0, 0, 0.3)', display: 'flex', alignItems: 'center', gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>⚡ {poll.question}</span>
              </div>
            ))}
          </div>
        )}

      {/* Chat Area */}
      <div className="arena-chat">
        <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {events.map((e, idx) => {
            const isMe = e.user_id === profile.id

            const isPollDrop = e.event_type === 'POLL_DROP' || (e.event_type === 'CHAT' && e.embedded_poll_id)
            if (isPollDrop) {
              const poll = allPolls.find(p => p.id === e.embedded_poll_id)
              if (!poll) {
                // If poll data not found for some reason, just render as regular chat
                return (
                  <div key={e.id || idx} className={`chat-bubble-row ${isMe ? 'me' : 'them'}`}>
                    <div className={`chat-bubble ${isMe ? 'me' : 'them'}`} style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      {e.content || 'A poll was dropped'}
                    </div>
                  </div>
                )
              }
              const isClosed = new Date() >= new Date(poll.closes_at)
              const isActive = !!activePolls[poll.id]
              const thisPollAnswered = !!answeredPolls[poll.id]
              const thisPollTimeRemaining = pollTimeRemainingMap[poll.id] || 0
              
              const relevantVotes = isClosed ? allPollVotes.filter(v => v.poll_id === poll.id) : (pollVotesMap[poll.id] || [])
              const totalVotes = relevantVotes.length

              return (
                <div key={e.id} ref={el => { pollMessageRefs.current[poll.id] = el }} style={{ margin: '16px 0', width: '100%' }}>
                  <div className="chat-name" style={{ textAlign: 'center', marginBottom: '8px' }}>⚡ {poll.profiles?.display_name || 'User'} dropped a Poll</div>
                  <div className="chat-bubble" style={{ maxWidth: '100%', background: 'var(--surface-card)', border: '1px solid var(--cup-gold)', borderRadius: '12px', margin: '0 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '12px' }}>{poll.question}</div>
                    
                    {!isClosed && isActive && (
                      <>
                        <div style={{ width: '100%', height: '4px', background: 'var(--surface-raised)', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(thisPollTimeRemaining / (poll.duration_seconds * 1000)) * 100}%`, background: 'var(--cup-red)', transition: 'width 0.1s linear' }} />
                        </div>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {poll.options.map((opt: string, i: number) => {
                            const vCount = relevantVotes.filter(v => v.option_idx === i).length
                            const percent = totalVotes > 0 ? Math.round((vCount / totalVotes) * 100) : 0
                            const isMyVote = relevantVotes.find(v => v.user_id === profile.id)?.option_idx === i

                            return (
                              <button key={i} className="btn" onClick={() => answerPoll(poll.id, i)} disabled={thisPollAnswered}
                                style={{
                                  position: 'relative', overflow: 'hidden', justifyContent: 'space-between', padding: '10px 14px',
                                  background: isMyVote ? 'var(--surface-raised)' : 'var(--surface-hover)',
                                  border: isMyVote ? '1px solid var(--cup-gold)' : '1px solid var(--border-default)',
                                  opacity: thisPollAnswered && !isMyVote ? 0.7 : 1
                                }}>
                                {thisPollAnswered && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${percent}%`, background: 'rgba(255, 215, 0, 0.2)' }} />}
                                <span style={{ position: 'relative', zIndex: 1 }}>{opt}</span>
                                {thisPollAnswered && <span style={{ position: 'relative', zIndex: 1, fontSize: '12px', fontWeight: 800, color: 'var(--cup-gold)' }}>{percent}%</span>}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}

                    {isClosed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--cup-red)', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>POLL CLOSED - RESULTS</div>
                        {poll.options.map((opt: string, i: number) => {
                          const voters = relevantVotes.filter(v => v.option_idx === i)
                          const percent = totalVotes > 0 ? Math.round((voters.length / totalVotes) * 100) : 0
                          return (
                            <div key={i} style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 700 }}>
                                <span>{opt}</span>
                                <span style={{ color: 'var(--cup-gold)' }}>{percent}%</span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {voters.map(v => (
                                  <span key={v.id} style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                    {v.profiles?.display_name || 'User'}
                                  </span>
                                ))}
                                {voters.length === 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>No votes</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <div key={e.id || idx} className={`chat-bubble-row ${isMe ? 'me' : 'them'}`}>
                {!isMe && (
                  <div className="chat-avatar">
                    {(e.profiles?.display_name || '?').substring(0,2).toUpperCase()}
                  </div>
                )}
                <div className={`chat-bubble ${isMe ? 'me' : 'them'}`}>
                  {!isMe && <div className="chat-name">{e.profiles?.display_name || 'Unknown User'}</div>}
                  <div style={{ wordBreak: 'break-word' }}>{e.content}</div>
                </div>
              </div>
            )
          })}
          <div ref={eventsEndRef} />
        </div>
      </div>

      {/* Create Flash Poll Modal */}
      {showCreatePoll && (
        <div className="flash-poll-overlay" style={{ zIndex: 100 }}>
          <div className="flash-poll-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Create Flash Poll</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreatePoll(false)}><X size={16} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '12px' }}>Question</label>
                <input className="form-input" value={newPollQ} onChange={e => setNewPollQ(e.target.value)} placeholder="Who will score next?" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {newPollOptions.map((opt, i) => (
                  <div key={i}>
                    <label className="form-label" style={{ fontSize: '10px' }}>Option {i+1} {i > 1 && '(Optional)'}</label>
                    <input className="form-input" value={opt} onChange={e => {
                      const newOpts = [...newPollOptions]; newOpts[i] = e.target.value; setNewPollOptions(newOpts)
                    }} />
                  </div>
                ))}
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px' }}>Duration</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[15, 30, 60, 120].map(s => (
                    <button key={s} className={`btn ${newPollDuration === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setNewPollDuration(s)} style={{ flex: 1, padding: '6px' }}>
                      {s}s
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary btn-lg" style={{ marginTop: '8px' }} onClick={dropPoll} disabled={creatingPoll}>
                {creatingPoll ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
                Drop Poll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="arena-controls">
        <div className="reaction-bar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button onClick={() => setShowCreatePoll(true)} className="btn-reaction" title="Create Flash Poll"><BarChart2 size={24} color="var(--text-secondary)" /></button>
          <button onClick={() => sendReaction('⚽')} className="btn-reaction">⚽</button>
          <button onClick={() => sendReaction('🔥')} className="btn-reaction">🔥</button>
          <button onClick={() => sendReaction('👏')} className="btn-reaction">👏</button>
          <button onClick={() => sendReaction('😂')} className="btn-reaction">😂</button>
          <button onClick={() => sendReaction('🤯')} className="btn-reaction">🤯</button>
          <button onClick={() => sendReaction('🟥')} className="btn-reaction">🟥</button>
        </div>
        <form onSubmit={sendChat} className="chat-input-form">
          <input 
            type="text" 
            className="form-input" 
            placeholder="Trash talk goes here..." 
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            style={{ borderRadius: '24px' }}
          />
          <button type="submit" className="btn btn-primary btn-icon" style={{ borderRadius: '50%', width: '40px', height: '40px' }}>
            <Send size={16} />
          </button>
        </form>
      </div>

      <style jsx>{`
        .arena-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-height: 100dvh;
          background: #0A0C10;
          color: #fff;
          position: relative;
          overflow: hidden;
        }
        .arena-header {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: rgba(20,20,20,0.8);
          border-bottom: 1px solid var(--border-subtle);
          z-index: 10;
        }
        .arena-match-info {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 auto;
        }
        .arena-pulse-dot {
          width: 8px; height: 8px; border-radius: 50%; background: var(--cup-red);
          animation: pulse 1.5s infinite;
        }
        .arena-title {
          font-size: 13px; font-weight: 800; color: var(--cup-red); letter-spacing: 1px;
        }
        .arena-teams {
          font-size: 16px; font-weight: 700; color: var(--text-primary);
        }
        .arena-chat {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .chat-bubble-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          width: 100%;
        }
        .chat-bubble-row.me { justify-content: flex-end; }
        .chat-bubble-row.them { justify-content: flex-start; }
        .chat-avatar {
          width: 24px; height: 24px; border-radius: 50%; background: var(--surface-raised);
          display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800;
        }
        .chat-bubble {
          max-width: 75%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.4;
          display: flex; flex-direction: column;
        }
        .chat-bubble.me {
          background: var(--cup-blue);
          border-bottom-right-radius: 4px;
        }
        .chat-bubble.them {
          background: var(--surface-card);
          border: 1px solid var(--border-subtle);
          border-bottom-left-radius: 4px;
        }
        .chat-name {
          font-size: 10px; color: var(--text-muted); font-weight: 600; margin-bottom: 2px;
        }
        
        .floating-emoji-container {
          position: absolute;
          bottom: 120px;
          left: 0; right: 0; top: 0;
          pointer-events: none;
          z-index: 5;
        }
        .floating-emoji {
          position: absolute;
          bottom: 0;
          font-size: 32px;
          animation: floatUp 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0.5); opacity: 1; }
          100% { transform: translateY(-300px) scale(1.5); opacity: 0; }
        }

        .arena-controls {
          padding: 12px 16px;
          background: var(--surface-raised);
          border-top: 1px solid var(--border-subtle);
          z-index: 10;
          display: flex; flex-direction: column; gap: 8px;
        }
        .reaction-bar {
          display: flex; justify-content: center; gap: 16px;
        }
        .btn-reaction {
          background: none; border: none; font-size: 24px; cursor: pointer; transition: transform 0.1s;
        }
        .btn-reaction:active { transform: scale(1.3); }
        
        .chat-input-form {
          display: flex; gap: 8px; align-items: center;
        }

        .flash-poll-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(4px);
          z-index: 50;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: fadeIn 0.3s ease-out;
        }
        .flash-poll-card {
          background: var(--surface-card);
          border: 1px solid var(--border-default);
          border-radius: 16px;
          padding: 24px;
          width: 100%; max-width: 400px;
          position: relative; overflow: hidden;
          box-shadow: 0 0 40px rgba(255, 215, 0, 0.1);
        }
        .flash-poll-fuse {
          position: absolute; top: 0; left: 0; height: 4px; background: var(--cup-red);
          box-shadow: 0 0 10px var(--cup-red);
          transition: width 0.1s linear;
        }
        .flash-poll-header {
          display: flex; align-items: center; gap: 8px;
          color: var(--cup-gold); font-weight: 800; font-size: 12px; margin-bottom: 16px;
        }
        .flash-poll-q {
          font-size: 18px; font-weight: 700; margin-bottom: 24px;
        }
        .flash-poll-grid {
          display: grid; grid-template-columns: 1fr; gap: 12px;
        }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,69,96,0.7); }
          70% { box-shadow: 0 0 0 6px rgba(255,69,96,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,69,96,0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
