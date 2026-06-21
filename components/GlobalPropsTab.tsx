'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'
import { Loader2, CheckCircle, Clock, Lock, Search, Trophy } from 'lucide-react'

interface Props {
  profile: Profile
}

export default function GlobalPropsTab({ profile }: Props) {
  const supabase = createClient()
  const [propsList, setPropsList] = useState<any[]>([])
  const [answers, setAnswers] = useState<any[]>([])
  const [allAnswers, setAllAnswers] = useState<any[]>([]) // For whistleblower reveal
  
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  
  // Local selections: map prop_id to value. 
  // Value could be player_id, team_id, number, or text depending on answer_type.
  const [selections, setSelections] = useState<Record<number, any>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Search states for player fuzzy search
  const [playerSearchQuery, setPlayerSearchQuery] = useState<Record<number, string>>({})
  const [showPlayerDropdown, setShowPlayerDropdown] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    setLoading(true)
    
    // Fetch reference data
    const [{ data: pData }, { data: tData }, { data: profData }] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('profiles').select('*')
    ])
    if (pData) setPlayers(pData)
    if (tData) setTeams(tData)
    if (profData) {
      const profMap: Record<string, Profile> = {}
      profData.forEach(p => profMap[p.id] = p)
      setProfiles(profMap)
    }

    // Fetch Props
    const { data: propsData } = await supabase
      .from('global_props')
      .select('*')
      .order('closes_at', { ascending: true })
    
    if (propsData) setPropsList(propsData)

    // Fetch My Answers
    const { data: myAnswersData } = await supabase
      .from('global_prop_answers')
      .select('*')
      .eq('user_id', profile.id)
    
    if (myAnswersData) {
      setAnswers(myAnswersData)
      const initSels: Record<number, any> = {}
      myAnswersData.forEach(a => {
        const prop = propsData?.find(p => p.id === a.prop_id)
        if (!prop) return
        if (prop.answer_type === 'PLAYER') initSels[a.prop_id] = a.answer_player_id
        else if (prop.answer_type === 'TEAM') initSels[a.prop_id] = a.answer_team_id
        else initSels[a.prop_id] = a.answer_text
      })
      setSelections(initSels)
    }

    // Fetch ALL answers for Whistleblower Reveal (RLS handles visibility)
    const { data: allAnswersData } = await supabase
      .from('global_prop_answers')
      .select('*')
    if (allAnswersData) setAllAnswers(allAnswersData)

    setLoading(false)
  }

  const handleSave = async (propId: number, answerType: string) => {
    const selected = selections[propId]
    if (selected === undefined || selected === '') return

    setSavingId(propId)
    try {
      const payload: any = { prop_id: propId, user_id: profile.id }
      if (answerType === 'PLAYER') payload.answer_player_id = parseInt(selected)
      else if (answerType === 'TEAM') payload.answer_team_id = parseInt(selected)
      else payload.answer_text = String(selected)

      const { error } = await supabase.from('global_prop_answers').upsert(payload, { onConflict: 'prop_id,user_id' })
      if (error) throw error
      
      setSavedId(propId)
      setTimeout(() => setSavedId(null), 3000)
    } catch (err: any) {
      console.error(err)
      alert("Error saving prediction: " + err.message)
    } finally {
      setSavingId(null)
    }
  }

  const renderInput = (prop: any, isLocked: boolean) => {
    const val = selections[prop.id] || ''

    if (prop.answer_type === 'TEAM') {
      return (
        <select 
          className="form-select" 
          value={val} 
          onChange={e => setSelections({ ...selections, [prop.id]: e.target.value })}
          disabled={isLocked}
        >
          <option value="">Select Team...</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.flag_emoji} {t.name}</option>)}
        </select>
      )
    }
    if (prop.answer_type === 'NUMBER') {
      return (
        <input 
          type="number" 
          className="form-input" 
          placeholder="0" 
          value={val} 
          onChange={e => setSelections({ ...selections, [prop.id]: e.target.value })}
          disabled={isLocked}
        />
      )
    }
    if (prop.answer_type === 'TEXT') {
      return (
        <input 
          type="text" 
          className="form-input" 
          placeholder="Your prediction..." 
          value={val} 
          onChange={e => setSelections({ ...selections, [prop.id]: e.target.value })}
          disabled={isLocked}
        />
      )
    }
    if (prop.answer_type === 'PLAYER') {
      const q = playerSearchQuery[prop.id] !== undefined ? playerSearchQuery[prop.id] : ''
      const selectedPlayer = players.find(p => p.id === val)
      const displayVal = selectedPlayer ? selectedPlayer.name : q
      
      const filtered = players.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5)

      return (
        <div style={{ position: 'relative' }}>
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search player..." 
              value={displayVal} 
              disabled={isLocked}
              onFocus={() => setShowPlayerDropdown({ ...showPlayerDropdown, [prop.id]: true })}
              onBlur={() => setTimeout(() => setShowPlayerDropdown({ ...showPlayerDropdown, [prop.id]: false }), 200)}
              onChange={e => {
                setPlayerSearchQuery({ ...playerSearchQuery, [prop.id]: e.target.value })
                if (val) setSelections({ ...selections, [prop.id]: '' }) // Clear selection if typing
              }}
              style={{ paddingLeft: '32px' }}
            />
          </div>
          {showPlayerDropdown[prop.id] && !isLocked && filtered.length > 0 && (
            <div className="player-dropdown">
              {filtered.map(p => (
                <div 
                  key={p.id} 
                  className="player-option"
                  onClick={() => {
                    setSelections({ ...selections, [prop.id]: p.id })
                    setPlayerSearchQuery({ ...playerSearchQuery, [prop.id]: p.name })
                    setShowPlayerDropdown({ ...showPlayerDropdown, [prop.id]: false })
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{teams.find(t => t.id === p.team_id)?.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  const renderWhistleblower = (prop: any) => {
    // Collect all answers for this prop
    const propAnswers = allAnswers.filter(a => a.prop_id === prop.id)
    if (propAnswers.length === 0) return <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>No predictions were recorded for this prop.</div>

    return (
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: '700',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {/* <Search size={14} style={{ color: 'var(--cup-gold)' }} /> */}
            <span>Friends Predictions</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
            {propAnswers.length} Predictions
          </span>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '12px',
          padding: '16px'
        }}>
          {propAnswers.map(ans => {
            const prof = profiles[ans.user_id]
            let displayAns = ans.answer_text
            if (prop.answer_type === 'PLAYER') {
              displayAns = players.find(p => p.id === ans.answer_player_id)?.name || 'Unknown'
            } else if (prop.answer_type === 'TEAM') {
              const t = teams.find(t => t.id === ans.answer_team_id)
              displayAns = t ? `${t.flag_emoji} ${t.name}` : 'Unknown'
            }

            return (
              <div key={ans.id} style={{
                background: 'var(--surface-card)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '12px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                position: 'relative'
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2a3143 0%, #1a1f2e 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: '800', flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}>
                  {prof?.avatar_letter || '?'}
                </div>
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {prof?.display_name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayAns}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="spinner" /></div>

  if (propsList.length === 0) {
    return (
      <div className="empty-state">
        <span style={{ fontSize: '40px' }}>🔮</span>
        <h3 className="hud-header">No Tournament Predictions</h3>
        <p className="text-muted" style={{ maxWidth: '300px' }}>
          Global futures are not available right now. Check back later!
        </p>
      </div>
    )
  }

  const handleShareGlobalRoom = async () => {
    const text = `The Global Predictions room is open on TACT-IX! Make your tournament picks now before they lock!\n\nJoin at: ${window.location.origin}/dashboard`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'TACT-IX Global Polls', text })
      } else {
        await navigator.clipboard.writeText(text)
        alert('Share message copied to clipboard!')
      }
    } catch (err) {
      console.log('Share canceled or failed', err)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {profile.is_admin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleShareGlobalRoom} className="btn btn-primary btn-sm" style={{ padding: '8px 16px' }}>
            Share Global Room
          </button>
        </div>
      )}
      {propsList.map(prop => {
        const isCompleted = prop.is_settled
        const isLocked = isCompleted || new Date() >= new Date(prop.closes_at)
        const myAnswer = answers.find(a => a.prop_id === prop.id)

        let correctDisplay = prop.correct_answer_text
        if (prop.answer_type === 'PLAYER') correctDisplay = players.find(p => p.id === prop.correct_answer_player_id)?.name
        if (prop.answer_type === 'TEAM') {
          const ct = teams.find(t => t.id === prop.correct_answer_team_id)
          correctDisplay = ct ? `${ct.flag_emoji} ${ct.name}` : ''
        }

        // Determine dynamic card styling
        let cardStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px', transition: 'all 0.3s ease' }
        if (isLocked) {
          cardStyle = { ...cardStyle, background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)', opacity: 0.85 }
        } else if (myAnswer) {
          cardStyle = { ...cardStyle, background: 'rgba(255, 215, 0, 0.03)', borderColor: 'var(--cup-gold)' }
        } else {
          cardStyle = { ...cardStyle, background: 'var(--surface-card)', borderColor: 'var(--border-default)' }
        }

        return (
          <div key={prop.id} className="bento-card" style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="slant-block" style={{ padding: '6px 16px', alignSelf: 'flex-start' }}>
                <span className="hud-header" style={{ fontSize: '13px' }}>Tournament Prop</span>
              </div>
              {isCompleted ? (
                <span className="badge badge-gray">Locked & Revealed</span>
              ) : isLocked ? (
                <span className="badge badge-red"><Lock size={12} style={{ marginRight: '4px' }} /> Locked</span>
              ) : myAnswer ? (
                <span className="badge badge-gold"><CheckCircle size={12} style={{ marginRight: '4px' }} /> Attended</span>
              ) : (
                <span className="badge badge-green"><Clock size={12} style={{ marginRight: '4px' }} /> Live</span>
              )}
            </div>

            <p style={{ fontSize: '18px', fontWeight: 800, margin: '8px 0 0 0', lineHeight: 1.3 }}>{prop.question}</p>
            
            {!isLocked && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Locks on {new Date(prop.closes_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {isCompleted && correctDisplay && (
               <div style={{ background: 'rgba(57, 255, 20, 0.1)', border: '1px solid var(--cup-green)', padding: '16px', borderRadius: '12px', fontSize: '15px', color: 'var(--cup-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <Trophy size={18} />
                 <span><strong>Winning Result:</strong> {correctDisplay}</span>
               </div>
            )}

            {/* Input Phase */}
            {!isLocked && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                {renderInput(prop, isLocked)}
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleSave(prop.id, prop.answer_type)}
                  disabled={savingId === prop.id || !selections[prop.id]}
                  style={{ alignSelf: 'flex-end', minWidth: '140px', padding: '12px 20px' }}
                >
                  {savingId === prop.id ? <><Loader2 size={16} className="spinner" /> Saving...</> 
                    : savedId === prop.id ? <><CheckCircle size={16} /> Saved Successfully!</>
                    : myAnswer ? 'Update Prediction' : 'Lock Prediction In'}
                </button>
              </div>
            )}

            {/* Locked Phase: Whistleblower Reveal */}
            {isLocked && (
              <div style={{ marginTop: '12px' }}>
                {renderWhistleblower(prop)}
              </div>
            )}
          </div>
        )
      })}
      
      {/* Styles moved to globals.css */}
    </div>
  )
}
