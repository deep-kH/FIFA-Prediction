'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Trophy, Loader2, Clock, CheckSquare, Search } from 'lucide-react'

export default function GlobalPropManager({ matches, onSaved }: { matches: any[], onSaved: () => void }) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'create' | 'settle'>('create')

  // Global State
  const [players, setPlayers] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [unsettledProps, setUnsettledProps] = useState<any[]>([])
  
  // Create State
  const [question, setQuestion] = useState('')
  const [answerType, setAnswerType] = useState<'PLAYER' | 'TEAM' | 'NUMBER' | 'TEXT'>('PLAYER')
  const [daysToClose, setDaysToClose] = useState('7')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Settle State
  const [settleAnswers, setSettleAnswers] = useState<Record<number, any>>({})
  const [settling, setSettling] = useState(false)
  const [playerSearchQuery, setPlayerSearchQuery] = useState<Record<number, string>>({})
  const [showPlayerDropdown, setShowPlayerDropdown] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    const [{ data: pData }, { data: tData }, { data: propsData }] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('teams').select('*').order('name'),
      supabase.from('global_props').select('*').eq('is_settled', false).order('created_at', { ascending: false })
    ])
    if (pData) setPlayers(pData)
    if (tData) setTeams(tData)
    if (propsData) setUnsettledProps(propsData)
  }

  const handleCreate = async () => {
    if (!question) {
      setError('Please provide a question.')
      return
    }
    
    setCreating(true)
    setError(null)

    const closesAt = new Date(Date.now() + parseFloat(daysToClose) * 86400000).toISOString()

    try {
      const { error: propError } = await supabase.from('global_props').insert({
        question,
        answer_type: answerType,
        closes_at: closesAt
      })

      if (propError) throw propError

      setQuestion('')
      fetchData()
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSettle = async (prop: any) => {
    const correctVal = settleAnswers[prop.id]
    if (correctVal === undefined || correctVal === '') return

    setSettling(true)
    try {
      const payload: any = { is_settled: true }
      if (prop.answer_type === 'PLAYER') payload.correct_answer_player_id = parseInt(correctVal)
      else if (prop.answer_type === 'TEAM') payload.correct_answer_team_id = parseInt(correctVal)
      else payload.correct_answer_text = String(correctVal)

      // 1. Update prop as settled with correct answer
      await supabase.from('global_props').update(payload).eq('id', prop.id)
      
      // Note: No points are awarded for global props!
      
      fetchData()
      onSaved()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSettling(false)
    }
  }

  const renderSettleInput = (prop: any) => {
    const val = settleAnswers[prop.id] || ''

    if (prop.answer_type === 'TEAM') {
      return (
        <select className="form-select" value={val} onChange={e => setSettleAnswers({ ...settleAnswers, [prop.id]: e.target.value })}>
          <option value="">Select correct team...</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.flag_emoji} {t.name}</option>)}
        </select>
      )
    }
    if (prop.answer_type === 'NUMBER') {
      return <input type="number" className="form-input" placeholder="Correct number..." value={val} onChange={e => setSettleAnswers({ ...settleAnswers, [prop.id]: e.target.value })} />
    }
    if (prop.answer_type === 'TEXT') {
      return <input type="text" className="form-input" placeholder="Correct answer..." value={val} onChange={e => setSettleAnswers({ ...settleAnswers, [prop.id]: e.target.value })} />
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
              placeholder="Search correct player..." 
              value={displayVal} 
              onFocus={() => setShowPlayerDropdown({ ...showPlayerDropdown, [prop.id]: true })}
              onBlur={() => setTimeout(() => setShowPlayerDropdown({ ...showPlayerDropdown, [prop.id]: false }), 200)}
              onChange={e => {
                setPlayerSearchQuery({ ...playerSearchQuery, [prop.id]: e.target.value })
                if (val) setSettleAnswers({ ...settleAnswers, [prop.id]: '' })
              }}
              style={{ paddingLeft: '32px' }}
            />
          </div>
          {showPlayerDropdown[prop.id] && filtered.length > 0 && (
            <div className="player-dropdown">
              {filtered.map(p => (
                <div 
                  key={p.id} 
                  className="player-option"
                  onClick={() => {
                    setSettleAnswers({ ...settleAnswers, [prop.id]: p.id })
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('create')}>
          Create Prop
        </button>
        <button className={`btn ${activeTab === 'settle' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('settle')}>
          Settle Props ({unsettledProps.length})
        </button>
      </div>

      {activeTab === 'create' && (
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label className="form-label">Question</label>
            <input className="form-input" placeholder="e.g. Who will win the Golden Boot?" value={question} onChange={e => setQuestion(e.target.value)} />
          </div>

          <div>
            <label className="form-label">Answer Type</label>
            <select className="form-select" value={answerType} onChange={e => setAnswerType(e.target.value as any)}>
              <option value="PLAYER">Player Selection (Fuzzy Search)</option>
              <option value="TEAM">Team Selection (Dropdown)</option>
              <option value="NUMBER">Number Input</option>
              <option value="TEXT">Free Text</option>
            </select>
          </div>

          <div>
            <label className="form-label">Time until Lock (Days)</label>
            <input type="number" step="0.1" className="form-input" value={daysToClose} onChange={e => setDaysToClose(e.target.value)} />
          </div>

          {error && <div className="login-error" style={{ fontSize: '13px' }}>{error}</div>}

          <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 size={16} className="spinner" /> : 'Launch Prop'}
          </button>
        </div>
      )}

      {activeTab === 'settle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {unsettledProps.length === 0 && <p className="text-muted">No unsettled props.</p>}
          {unsettledProps.map(prop => (
            <div key={prop.id} className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="badge badge-blue">Global Prop</span>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  <Clock size={11} style={{ display: 'inline', marginRight: '4px' }}/>
                  {new Date(prop.closes_at) > new Date() ? 'Still Open' : 'Locked'}
                </span>
              </div>
              <p style={{ fontWeight: 700, margin: 0 }}>{prop.question}</p>
              
              <div style={{ marginTop: '8px' }}>
                <label className="form-label">Correct Answer</label>
                {renderSettleInput(prop)}
              </div>
              
              <button 
                className="btn btn-danger btn-sm" 
                style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                onClick={() => handleSettle(prop)}
                disabled={!settleAnswers[prop.id] || settling}
              >
                <CheckSquare size={14} /> Lock & Reveal Predictions
              </button>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .spinner { animation: spin 0.7s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .search-input-wrapper {
          position: relative;
        }
        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        .player-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--surface-card);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          margin-top: 4px;
          z-index: 10;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        .player-option {
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          border-bottom: 1px solid var(--border-subtle);
          font-size: 13px;
        }
        .player-option:last-child { border-bottom: none; }
        .player-option:hover { background: var(--surface-raised); }
      `}</style>
    </div>
  )
}
