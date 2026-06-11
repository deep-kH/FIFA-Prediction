'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CheckSquare, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'

interface Props {
  matches: any[]
  onSettled: () => void
}

export default function SettlementConsole({ matches, onSettled }: Props) {
  const supabase = createClient()
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [topScorerId, setTopScorerId] = useState('')
  const [pollAnswers, setPollAnswers] = useState<Record<number, string>>({})
  const [players, setPlayers] = useState<any[]>([])
  const [settling, setSettling] = useState(false)
  const [settled, setSettled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const unsettledMatches = matches.filter(m => !m.is_completed)
  const selectedMatch = matches.find(m => m.id === parseInt(selectedMatchId))

  useEffect(() => {
    if (!selectedMatch) {
      setTimeout(() => setPlayers([]), 0)
      return
    }
    supabase.from('players').select('*, teams(*)')
      .in('team_id', [selectedMatch.home_team_id, selectedMatch.away_team_id])
      .order('name')
      .then(({ data }) => setPlayers(data || []))
    setTimeout(() => {
      setHomeScore(''); setAwayScore(''); setTopScorerId(''); setPollAnswers({})
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatchId])

  const handleSettle = async () => {
    if (!selectedMatchId || homeScore === '' || awayScore === '') {
      setError('Please fill the final score.')
      return
    }
    setSettling(true)
    setError(null)

    try {
      // Update poll correct answers first
      if (selectedMatch?.custom_polls) {
        for (const poll of selectedMatch.custom_polls) {
          if (pollAnswers[poll.id]) {
            await supabase.from('custom_polls')
              .update({ correct_option: pollAnswers[poll.id] })
              .eq('id', poll.id)
          }
        }
      }

      // Update match with results — trigger fires settlement function automatically
      const { error: matchError } = await supabase.from('matches')
        .update({
          home_score: parseInt(homeScore),
          away_score: parseInt(awayScore),
          top_scorer_id: topScorerId ? parseInt(topScorerId) : null,
          is_completed: true,
        })
        .eq('id', parseInt(selectedMatchId))

      if (matchError) throw matchError

      setSettled(true)
      setShowConfirm(false)
      setTimeout(() => setSettled(false), 5000)
      setSelectedMatchId('')
      onSettled()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSettling(false)
    }
  }

  const homePlayers = players.filter(p => p.team_id === selectedMatch?.home_team_id)
  const awayPlayers = players.filter(p => p.team_id === selectedMatch?.away_team_id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {settled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '12px', color: 'var(--cup-green)' }}>
          <CheckCircle size={16} />
          <span style={{ fontWeight: 600 }}>Match settled! Leaderboard updated automatically.</span>
        </div>
      )}

      <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Settlement Sheet</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Enter the final match results. Clicking "Settle Game" triggers automatic point calculations for all friends.
        </p>

        <div>
          <label className="form-label" htmlFor="settle-match-select">Select Match to Settle</label>
          <select id="settle-match-select" className="form-select" value={selectedMatchId} onChange={e => setSelectedMatchId(e.target.value)}>
            <option value="">Choose match...</option>
            {unsettledMatches.map(m => (
              <option key={m.id} value={m.id}>
                {m.home_team?.flag_emoji} {m.home_team?.name} vs {m.away_team?.flag_emoji} {m.away_team?.name} · {new Date(m.kickoff_time).toLocaleDateString()}
              </option>
            ))}
          </select>
          {unsettledMatches.length === 0 && <p className="text-muted" style={{ fontSize: '13px', marginTop: '8px' }}>All matches have been settled.</p>}
        </div>

        {selectedMatch && (
          <>
            {/* Final Score */}
            <div>
              <label className="form-label">Final Score *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '18px' }}>{selectedMatch.home_team?.flag_emoji}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedMatch.home_team?.name}</span>
                  <input id="settle-home-score" type="number" min={0} className="score-input" value={homeScore} onChange={e => setHomeScore(e.target.value)} placeholder="0" />
                </div>
                <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-muted)', marginTop: '30px' }}>–</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '18px' }}>{selectedMatch.away_team?.flag_emoji}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedMatch.away_team?.name}</span>
                  <input id="settle-away-score" type="number" min={0} className="score-input" value={awayScore} onChange={e => setAwayScore(e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>

            {/* Top Scorer */}
            <div>
              <label className="form-label" htmlFor="settle-top-scorer">Official Top Scorer</label>
              <select id="settle-top-scorer" className="form-select" value={topScorerId} onChange={e => setTopScorerId(e.target.value)}>
                <option value="">No scorer / N/A</option>
                {homePlayers.length > 0 && (
                  <optgroup label={`${selectedMatch.home_team?.flag_emoji} ${selectedMatch.home_team?.name}`}>
                    {homePlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                )}
                {awayPlayers.length > 0 && (
                  <optgroup label={`${selectedMatch.away_team?.flag_emoji} ${selectedMatch.away_team?.name}`}>
                    {awayPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                )}
              </select>
            </div>

            {/* MCQ Answers */}
            {selectedMatch.custom_polls && selectedMatch.custom_polls.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label className="form-label">Correct Poll Answers</label>
                {selectedMatch.custom_polls.map((poll: any, i: number) => (
                  <div key={poll.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--surface-raised)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600 }}>Q{i + 1}: {poll.question}</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(['A', 'B', 'C', 'D'] as const).map(opt => (
                        <button
                          key={opt}
                          id={`settle-poll-${poll.id}-${opt}`}
                          onClick={() => setPollAnswers(prev => ({ ...prev, [poll.id]: opt }))}
                          className={`mcq-option ${pollAnswers[poll.id] === opt ? 'selected' : ''}`}
                          style={{ flex: 'none', padding: '8px 14px' }}
                        >
                          <span className="mcq-key">{opt}</span>
                          <span style={{ fontSize: '12px' }}>
                            {opt === 'A' ? poll.option_a : opt === 'B' ? poll.option_b : opt === 'C' ? poll.option_c : poll.option_d}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && <div style={{ display: 'flex', gap: '8px', padding: '12px', background: 'rgba(255,69,96,0.1)', border: '1px solid rgba(255,69,96,0.3)', borderRadius: '10px', color: 'var(--cup-red)', fontSize: '13px' }}><AlertTriangle size={15} />{error}</div>}

            {!showConfirm ? (
              <button id="settle-confirm-btn" className="btn btn-success btn-lg" onClick={() => setShowConfirm(true)}>
                <CheckSquare size={16} /> Settle Game
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.25)', borderRadius: '12px' }}>
                <p style={{ fontSize: '14px', fontWeight: 700 }}>⚠️ Confirm Settlement</p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  This will lock the match permanently and calculate points for all friends. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button id="settle-execute-btn" className="btn btn-success" onClick={handleSettle} disabled={settling} style={{ flex: 1 }}>
                    {settling ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Settling...</> : '✓ Confirm & Settle'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
