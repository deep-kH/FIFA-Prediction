'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Match, Ballot, PollAnswer, Profile, CustomPoll } from '@/types/database'
import { Clock, Save, Lock, Eye, ChevronDown, ChevronUp, Loader2, CheckCircle } from 'lucide-react'

interface Props {
  match: any
  profile: Profile
  existingBallot?: Ballot
  existingPollAnswers?: PollAnswer[]
  allBallots?: any[]
  allPollAnswers?: any[]
  onBallotSaved: (ballot: Ballot) => void
  onPollAnswerSaved: (answer: PollAnswer) => void
}

export default function BallotCard({
  match, profile, existingBallot, existingPollAnswers = [],
  allBallots = [], allPollAnswers = [],
  onBallotSaved, onPollAnswerSaved, onProfileUpdated
}: Props & { onProfileUpdated?: (profile: Profile) => void }) {
  const supabase = createClient()
  const [homeScore, setHomeScore] = useState<string>(existingBallot?.predicted_home_score?.toString() ?? '')
  const [awayScore, setAwayScore] = useState<string>(existingBallot?.predicted_away_score?.toString() ?? '')
  const [homePenaltyScore, setHomePenaltyScore] = useState<string>(existingBallot?.predicted_home_penalty_score?.toString() ?? '')
  const [awayPenaltyScore, setAwayPenaltyScore] = useState<string>(existingBallot?.predicted_away_penalty_score?.toString() ?? '')
  const [topScorerId, setTopScorerId] = useState<string>(existingBallot?.predicted_top_scorer_id?.toString() ?? '')
  const [pollSelections, setPollSelections] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>(() => {
    const init: Record<number, 'A' | 'B' | 'C' | 'D'> = {}
    existingPollAnswers.forEach(pa => { init[pa.poll_id] = pa.selected_option as any })
    return init
  })
  const [players, setPlayers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 })
  const [showReveal, setShowReveal] = useState(false)
  const [expandedReveal, setExpandedReveal] = useState<Record<string, boolean>>({})
  const [activeCard, setActiveCard] = useState<'NONE' | 'MULTIPLIER' | 'SAFETY_NET'>(existingBallot?.played_card || 'NONE')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const kickoff = new Date(match.kickoff_time)
  const [isLocked, setIsLocked] = useState(false)
  const isCompleted = match.is_completed

  // Hydration-safe: compute isLocked only on the client after mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLocked(new Date() >= kickoff)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.kickoff_time])

  // Load squad players for both teams
  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('players')
        .select('*, teams(*)')
        .in('team_id', [match.home_team_id, match.away_team_id])
        .order('name')
      setPlayers(data || [])
    }
    fetchPlayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id])

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const diff = kickoff.getTime() - Date.now()
      if (diff <= 0) {
        setCountdown({ d: 0, h: 0, m: 0, s: 0 })
        setIsLocked(true)
        if (intervalRef.current) clearInterval(intervalRef.current)
        return
      }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown({ d, h, m, s })
    }
    tick()
    if (!isLocked) {
      intervalRef.current = setInterval(tick, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.kickoff_time])

  const handleSave = async () => {
    if (isLocked) return
    setSaving(true)
    setError(null)

    try {
      // Upsert ballot
      const isKnockoutDraw = match.stage !== 'Group' && homeScore !== '' && awayScore !== '' && homeScore === awayScore;

      const ballotPayload = {
        user_id: profile.id,
        match_id: match.id,
        predicted_home_score: homeScore !== '' ? parseInt(homeScore) : 0,
        predicted_away_score: awayScore !== '' ? parseInt(awayScore) : 0,
        predicted_home_penalty_score: isKnockoutDraw && homePenaltyScore !== '' ? parseInt(homePenaltyScore) : null,
        predicted_away_penalty_score: isKnockoutDraw && awayPenaltyScore !== '' ? parseInt(awayPenaltyScore) : null,
        predicted_top_scorer_id: topScorerId ? parseInt(topScorerId) : null,
      }

      const { data: savedBallot, error: ballotError } = existingBallot
        ? await supabase.from('ballots').update(ballotPayload).eq('id', existingBallot.id).select().single()
        : await supabase.from('ballots').insert(ballotPayload).select().single()

      if (ballotError) throw ballotError
      
      const ballotData = savedBallot as Ballot
      if (savedBallot) onBallotSaved(ballotData)

      // Apply Gamification Card via Secure RPC if changed
      if (activeCard !== (existingBallot?.played_card || 'NONE')) {
        const { error: rpcError } = await supabase.rpc('play_gamification_card', {
          p_match_id: match.id,
          p_card_type: activeCard
        })
        if (rpcError) throw new Error(`Wildcard Error: ${rpcError.message}`)
        
        // We mutate the local state to reflect the change immediately so subsequent saves don't re-trigger it
        ballotData.played_card = activeCard
        onBallotSaved(ballotData)

        // Optimistically update the frontend inventory immediately to prevent using one card twice
        if (onProfileUpdated) {
          const newProfile = { ...profile }
          // Refund old card if any
          if (existingBallot?.played_card === 'MULTIPLIER') newProfile.inventory_multiplier++
          if (existingBallot?.played_card === 'SAFETY_NET') newProfile.inventory_safety++
          // Deduct new card
          if (activeCard === 'MULTIPLIER') newProfile.inventory_multiplier--
          if (activeCard === 'SAFETY_NET') newProfile.inventory_safety--
          onProfileUpdated(newProfile)
        }
      }

      // Upsert poll answers
      for (const [pollId, selected] of Object.entries(pollSelections)) {
        const pollPayload = {
          user_id: profile.id,
          poll_id: parseInt(pollId),
          selected_option: selected,
        }
        const { data: savedAnswer, error: pollError } = await supabase
          .from('poll_answers')
          .upsert(pollPayload, { onConflict: 'user_id,poll_id' })
          .select()
          .single()

        if (pollError) throw pollError
        if (savedAnswer) onPollAnswerSaved(savedAnswer as PollAnswer)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const homePlayers = players.filter(p => p.team_id === match.home_team_id)
  const awayPlayers = players.filter(p => p.team_id === match.away_team_id)

  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Match Header */}
      <div className="ballot-header">
        <div className="ballot-match-info">
          <span className="badge badge-gray">{match.stage}</span>
          {isCompleted && <span className="badge badge-gray">Full Time</span>}
          {isLocked && !isCompleted && (
            <span className="badge badge-red">
              <span className="status-dot status-live" style={{ width: '6px', height: '6px' }} />
              Locked
            </span>
          )}
          {!isLocked && <span className="badge badge-green">Open</span>}
        </div>

        <div className="ballot-scoreline">
          <div className="ballot-team">
            <span className="ballot-flag">{match.home_team?.flag_emoji}</span>
            <span className="ballot-team-name">{match.home_team?.name}</span>
          </div>
          <div className="ballot-vs-block">
            {isCompleted ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="ballot-final-score">
                  {match.home_score} – {match.away_score}
                </span>
                {match.home_penalty_score !== null && match.away_penalty_score !== null && (
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    ({match.home_penalty_score} - {match.away_penalty_score} p)
                  </span>
                )}
              </div>
            ) : (
              <span className="ballot-vs-text">VS</span>
            )}
          </div>
          <div className="ballot-team ballot-team-away">
            <span className="ballot-flag">{match.away_team?.flag_emoji}</span>
            <span className="ballot-team-name">{match.away_team?.name}</span>
          </div>
        </div>

        {/* Countdown */}
        {!isLocked && (
          <div className="ballot-countdown">
            <Clock size={13} color="var(--text-muted)" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Locks in</span>
            {[
              { val: countdown.d, label: 'Days' },
              { val: countdown.h, label: 'Hrs' },
              { val: countdown.m, label: 'Min' },
              { val: countdown.s, label: 'Sec' },
            ].map(({ val, label }) => (
              <div key={label} className="countdown-block">
                <span className="countdown-number">{String(val).padStart(2, '0')}</span>
                <span className="countdown-label">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLocked && (
        <div className="ballot-locked-banner">
          <Lock size={14} />
          {isCompleted
            ? `Final Score: ${match.home_team?.name} ${match.home_score} – ${match.away_score} ${match.away_team?.name} ${match.home_penalty_score !== null ? `(${match.home_penalty_score}-${match.away_penalty_score} p)` : ''}`
            : 'Match has kicked off — predictions are now locked.'}
        </div>
      )}

      {/* ── PREDICTION FORM (HIDDEN IF LOCKED OR COMPLETED) ── */}
      {!isLocked && !isCompleted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Score Prediction */}
        <div className="ballot-section">
          <div className="slant-block" style={{ alignSelf: 'flex-start', padding: '4px 12px 4px 0' }}>
            <p className="ballot-section-title hud-header" style={{ margin: 0 }}>
              <span className="ballot-section-num">1</span>
              Scoreline Prediction
            </p>
          </div>
          <div className="score-prediction-row">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px' }}>{match.home_team?.flag_emoji}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '80px', textTransform: 'uppercase' }}>
                {match.home_team?.name}
              </span>
              <input
                id={`home-score-${match.id}`}
                type="number"
                min={0}
                max={20}
                className="score-input"
                value={homeScore}
                onChange={e => setHomeScore(e.target.value)}
                disabled={isLocked}
                placeholder="0"
              />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-muted)', paddingTop: '36px' }}>–</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px' }}>{match.away_team?.flag_emoji}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '80px' }}>
                {match.away_team?.name}
              </span>
              <input
                id={`away-score-${match.id}`}
                type="number"
                min={0}
                max={20}
                className="score-input"
                value={awayScore}
                onChange={e => setAwayScore(e.target.value)}
                disabled={isLocked}
                placeholder="0"
              />
            </div>
          </div>
          
          {match.stage !== 'Group' && homeScore !== '' && awayScore !== '' && homeScore === awayScore && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Penalty Shootout</p>
              <div className="score-prediction-row" style={{ gap: '16px' }}>
                <input
                  id={`home-penalty-score-${match.id}`}
                  type="number"
                  min={0}
                  max={20}
                  className="score-input"
                  style={{ width: '44px', height: '44px', fontSize: '18px' }}
                  value={homePenaltyScore}
                  onChange={e => setHomePenaltyScore(e.target.value)}
                  disabled={isLocked}
                  placeholder="0"
                />
                <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-muted)' }}>–</div>
                <input
                  id={`away-penalty-score-${match.id}`}
                  type="number"
                  min={0}
                  max={20}
                  className="score-input"
                  style={{ width: '44px', height: '44px', fontSize: '18px' }}
                  value={awayPenaltyScore}
                  onChange={e => setAwayPenaltyScore(e.target.value)}
                  disabled={isLocked}
                  placeholder="0"
                />
              </div>
            </div>
          )}
        </div>

        {/* Top Scorer Prop */}
        <div className="ballot-section">
          <div className="slant-block" style={{ alignSelf: 'flex-start', padding: '4px 12px 4px 0' }}>
            <p className="ballot-section-title hud-header" style={{ margin: 0 }}>
              <span className="ballot-section-num">2</span>
              Player of the Match
            </p>
          </div>
          {isLocked && isCompleted && match.top_scorer ? (
            <div className="ballot-result-reveal">
              <span>Player of the Match: <strong>{match.top_scorer.name}</strong></span>
              {existingBallot?.predicted_top_scorer_id === match.top_scorer_id
                ? <span className="badge badge-green">+3 pts ✓</span>
                : <span className="badge badge-gray">0 pts</span>}
            </div>
          ) : (
            <select
              id={`top-scorer-${match.id}`}
              className="form-select"
              value={topScorerId}
              onChange={e => setTopScorerId(e.target.value)}
              disabled={isLocked || players.length === 0}
            >
              <option value="">Select a player...</option>
              {homePlayers.length > 0 && (
                <optgroup label={`${match.home_team?.flag_emoji} ${match.home_team?.name}`}>
                  {homePlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              )}
              {awayPlayers.length > 0 && (
                <optgroup label={`${match.away_team?.flag_emoji} ${match.away_team?.name}`}>
                  {awayPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
        </div>

        {/* Custom Polls */}
        {match.custom_polls && match.custom_polls.length > 0 && (
          <div className="ballot-section">
            <div className="slant-block" style={{ alignSelf: 'flex-start', padding: '4px 12px 4px 0' }}>
              <p className="ballot-section-title hud-header" style={{ margin: 0 }}>
                <span className="ballot-section-num">3</span>
                Bonus Predictions
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {match.custom_polls.map((poll: CustomPoll, idx: number) => (
                <PollQuestion
                  key={poll.id}
                  poll={poll}
                  index={idx}
                  selected={pollSelections[poll.id]}
                  isLocked={isLocked}
                  isCompleted={isCompleted}
                  onSelect={opt => setPollSelections(prev => ({ ...prev, [poll.id]: opt }))}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Gamification Wildcards (Equip UI - HIDDEN IF COMPLETED) */}
      {!isLocked && (profile.inventory_multiplier > 0 || profile.inventory_safety > 0 || activeCard !== 'NONE') && (
        <div className="ballot-section" style={{ padding: '16px', background: 'rgba(20,20,20,0.4)', borderRadius: '12px', border: '1px dashed var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>🃏</span>
            <p style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Wildcards</p>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            <strong>Streaks:</strong> Predict with &ge; 30% accuracy to build your streak. Multiplier cards are awarded at streak multiples of 5! A skipped match or &lt; 30% accuracy resets your streak to 0.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Multiplier Card */}
            {(profile.inventory_multiplier > 0 || activeCard === 'MULTIPLIER') && (
              <button
                onClick={() => setActiveCard(activeCard === 'MULTIPLIER' ? 'NONE' : 'MULTIPLIER')}
                style={{
                  flex: 1, minWidth: '140px', padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                  background: activeCard === 'MULTIPLIER' ? 'linear-gradient(135deg, rgba(138,43,226,0.1), rgba(220,20,60,0.1))' : 'var(--surface-card)',
                  border: `2px solid ${activeCard === 'MULTIPLIER' ? '#8A2BE2' : 'var(--border-subtle)'}`,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>🔥</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: activeCard === 'MULTIPLIER' ? '#8A2BE2' : 'var(--text-primary)' }}>Halal Ball</span>
                </div>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Double points if accuracy ≥ 60%. Multiplies by 0.75x if accuracy ≤ 40%.
                </p>
              </button>
            )}
            
            {/* Safety Net Card */}
            {(profile.inventory_safety > 0 || activeCard === 'SAFETY_NET') && (
              <button
                onClick={() => setActiveCard(activeCard === 'SAFETY_NET' ? 'NONE' : 'SAFETY_NET')}
                style={{
                  flex: 1, minWidth: '140px', padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                  background: activeCard === 'SAFETY_NET' ? 'linear-gradient(135deg, rgba(245,200,66,0.1), rgba(205,127,50,0.1))' : 'var(--surface-card)',
                  border: `2px solid ${activeCard === 'SAFETY_NET' ? 'var(--cup-gold)' : 'var(--border-subtle)'}`,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>🛡️</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: activeCard === 'SAFETY_NET' ? 'var(--cup-gold)' : 'var(--text-primary)' }}>Haram Ball</span>
                </div>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  Adds a flat 5.5 bonus points to your final score.
                </p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Save / Error */}
      {!isLocked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {error && (
            <div className="login-error" style={{ borderRadius: '10px' }}>
              <span style={{ fontSize: '13px', color: 'var(--cup-red)' }}>{error}</span>
            </div>
          )}
          <button
            id={`save-ballot-${match.id}`}
            className="btn btn-primary btn-lg"
            onClick={handleSave}
            disabled={saving}
            style={{ width: '100%' }}
          >
            {saving ? (
              <><Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving...</>
            ) : saved ? (
              <><CheckCircle size={16} /> Ballot Saved!</>
            ) : (
              <><Save size={16} /> {existingBallot ? 'Update Ballot' : 'Submit Ballot'}</>
            )}
          </button>
        </div>
      )}

      {/* Whistleblower Reveal */}
      {isLocked && (
        <div style={{ marginTop: '16px', paddingTop: '20px', borderTop: '2px dashed var(--border-default)' }}>
          <div className="slant-block" style={{ alignSelf: 'flex-start', padding: '4px 12px 4px 0', marginBottom: '16px' }}>
            <p className="ballot-section-title hud-header" style={{ margin: 0, color: 'var(--cup-red)' }}>
              <Eye size={16} /> Friend's Predictions
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(() => {
              // Collect all unique user IDs who have either a ballot or a poll answer for this match
              const matchPollIds = (match.custom_polls || []).map((cp: any) => cp.id)
              const relevantPollAnswers = allPollAnswers.filter(pa => matchPollIds.includes(pa.poll_id))
              const relevantBallots = allBallots.filter(b => b.match_id === match.id)
              
              const uniqueUserIds = Array.from(new Set([
                ...relevantBallots.map(b => b.user_id),
                ...relevantPollAnswers.map(pa => pa.user_id)
              ]))

              if (uniqueUserIds.length === 0) {
                return <p className="text-muted" style={{ fontSize: '13px', textAlign: 'center' }}>No predictions submitted for this match.</p>
              }

              return uniqueUserIds.map(userId => {
                const b = relevantBallots.find(b => b.user_id === userId)
                const userPollAnswersForReveal = relevantPollAnswers.filter((pa: any) => pa.user_id === userId)
                
                // Get profile from either ballot or poll answer
                const userProfile = b?.profiles || userPollAnswersForReveal[0]?.profiles || { display_name: 'Unknown', avatar_letter: '?' }
                const isExpanded = expandedReveal[userId] || false

                return (
                  <div key={userId} style={{ padding: '12px', background: 'var(--surface-overlay)', borderRadius: '8px' }}>
                    <button 
                      onClick={() => setExpandedReveal(prev => ({ ...prev, [userId]: !prev[userId] }))}
                      style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="lb-avatar" style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                          {userProfile.avatar_letter}
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {userProfile.display_name}
                          {userId === profile.id && b?.played_card === 'MULTIPLIER' && <span title="Halal Ball" style={{ marginLeft: '6px' }}>🔥</span>}
                          {userId === profile.id && b?.played_card === 'SAFETY_NET' && <span title="Haram Ball" style={{ marginLeft: '6px' }}>🛡️</span>}
                          {userId === profile.id && <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>(You)</span>}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {b ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span className="font-score" style={{ fontSize: '24px', letterSpacing: '1px', color: 'var(--text-primary)', lineHeight: 1 }}>
                              {b.predicted_home_score} - {b.predicted_away_score}
                            </span>
                            {b.predicted_home_penalty_score !== null && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                ({b.predicted_home_penalty_score} - {b.predicted_away_penalty_score} p)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No Score</span>
                        )}
                        <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                        {b && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontWeight: 600 }}>Player of the match:</span>
                            <span className="text-secondary" style={{ flex: 1 }}>
                              {b.predicted_top_scorer_id 
                                ? players.find(p => p.id === b.predicted_top_scorer_id)?.name || 'Unknown Player'
                                : 'None selected'
                              }
                              {isCompleted && b.predicted_top_scorer_id && (
                                <span style={{ marginLeft: '6px' }}>
                                  {b.predicted_top_scorer_id === match.top_scorer_id ? '✓' : '✗'}
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {/* Poll Answers */}
                        {userPollAnswersForReveal.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                            {(match.custom_polls || []).map((poll: any) => {
                              const answer = userPollAnswersForReveal.find((pa: any) => pa.poll_id === poll.id)
                              if (!answer) return null
                              const optKey = `option_${answer.selected_option.toLowerCase()}` as keyof typeof poll
                              const optionText = poll[optKey] || answer.selected_option
                              const isCorrect = isCompleted && poll.correct_option === answer.selected_option

                              return (
                                <div key={poll.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px' }}>
                                  <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontWeight: 600 }}>Q:</span>
                                  <span className="text-secondary" style={{ flex: 1 }}>
                                    {poll.question.length > 40 ? poll.question.slice(0, 40) + '…' : poll.question}
                                  </span>
                                  <span className={`badge ${isCompleted ? (isCorrect ? 'badge-green' : 'badge-red') : 'badge-gray'}`}
                                    style={{ fontSize: '10px', padding: '1px 6px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    {answer.selected_option}: {optionText.length > 15 ? optionText.slice(0, 15) + '…' : optionText}
                                    {isCompleted && (isCorrect ? ' ✓' : ' ✗')}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {b && isCompleted && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                            {b.played_card === 'MULTIPLIER' && b.accuracy_rate >= 60 && (
                              <span className="badge badge-gold" style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(138,43,226,0.2)', color: '#8A2BE2', border: '1px solid rgba(138,43,226,0.5)' }}>
                                Halal 2x
                              </span>
                            )}
                            {b.played_card === 'MULTIPLIER' && b.accuracy_rate <= 40 && (
                              <span className="badge badge-red" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                Halal Penalty 0.75x
                              </span>
                            )}
                            {b.played_card === 'SAFETY_NET' && (
                              <span className="badge badge-gold" style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(245,200,66,0.2)', color: 'var(--cup-gold)', border: '1px solid rgba(245,200,66,0.5)' }}>
                                Haram +5.5
                              </span>
                            )}
                            {(b.score_points_earned || 0) > 0 && (
                              <span className="badge badge-green" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                {b.score_points_earned === 5 ? 'Exact Score (+5)' : 'Outcome (+2)'}
                              </span>
                            )}
                            {(b.team_points_earned || 0) > 0 && (
                              <span className="badge badge-blue" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                Team Goals (+{b.team_points_earned})
                              </span>
                            )}
                            {b.predicted_top_scorer_id === match.top_scorer_id && match.top_scorer_id && (
                              <span className="badge badge-gold" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                Scorer (+3)
                              </span>
                            )}
                            {(b.accuracy_bonus_earned || 0) > 0 && (
                              <span className="badge badge-gold" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                Bonus (+{b.accuracy_bonus_earned})
                              </span>
                            )}
                            {b.accuracy_rate > 0 && (
                              <span className="badge badge-gray" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                {b.accuracy_rate?.toFixed(0)}% Accuracy
                              </span>
                            )}
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      <style jsx>{`
        .ballot-header { display: flex; flex-direction: column; gap: 16px; }
        .ballot-match-info { display: flex; gap: 8px; align-items: center; }
        .ballot-scoreline {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 0;
        }
        .ballot-team { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
        .ballot-team-away { }
        .ballot-flag { font-size: 32px; }
        .ballot-team-name { font-size: 15px; font-weight: 700; text-align: center; }
        .ballot-vs-block { display: flex; align-items: center; justify-content: center; }
        .ballot-vs-text { font-family: 'Bebas Neue', cursive; font-size: 28px; color: var(--text-muted); }
        .ballot-final-score { font-family: 'Bebas Neue', cursive; font-size: 36px; color: var(--cup-gold); letter-spacing: 0.05em; }
        .ballot-countdown { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ballot-locked-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(255,69,96,0.08);
          border: 1px solid rgba(255,69,96,0.2);
          border-radius: 10px;
          font-size: 13px;
          color: var(--cup-red);
          font-weight: 500;
        }
        .ballot-section { display: flex; flex-direction: column; gap: 12px; }
        .ballot-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .ballot-section-num {
          width: 22px; height: 22px;
          background: var(--cup-gold);
          color: #0A0C10;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .score-prediction-row {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 24px;
        }
        .ballot-result-reveal {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--surface-raised);
          border: 1px solid var(--border-default);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 14px;
          gap: 12px;
        }
      `}</style>
    </div>
  )
}

// ─── MCQ POLL QUESTION COMPONENT ────────────────────────────────
function PollQuestion({ poll, index, selected, isLocked, isCompleted, onSelect }: {
  poll: CustomPoll
  index: number
  selected?: 'A' | 'B' | 'C' | 'D'
  isLocked: boolean
  isCompleted: boolean
  onSelect: (opt: 'A' | 'B' | 'C' | 'D') => void
}) {
  const optionLabels = { A: poll.option_a, B: poll.option_b, C: poll.option_c, D: poll.option_d }
  const options: ('A' | 'B' | 'C' | 'D')[] = (['A', 'B', 'C', 'D'] as ('A' | 'B' | 'C' | 'D')[]).filter(
    opt => optionLabels[opt] && optionLabels[opt].trim() !== ''
  )

  const getOptionClass = (opt: 'A' | 'B' | 'C' | 'D') => {
    if (isCompleted && poll.correct_option) {
      if (opt === poll.correct_option) return 'mcq-option correct'
      if (opt === selected && opt !== poll.correct_option) return 'mcq-option incorrect'
      return 'mcq-option'
    }
    if (opt === selected) return 'mcq-option selected'
    return 'mcq-option'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
        Q{index + 1}. {poll.question}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {options.map(opt => (
          <button
            key={opt}
            id={`poll-${poll.id}-opt-${opt}`}
            className={getOptionClass(opt)}
            onClick={() => !isLocked && onSelect(opt)}
            disabled={isLocked}
          >
            <span className="mcq-key">{opt}</span>
            <span style={{ fontSize: '13px' }}>{optionLabels[opt]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
