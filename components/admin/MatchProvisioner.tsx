'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, Trash2, HelpCircle, Loader2, CheckCircle } from 'lucide-react'

interface Props {
  onSaved: () => void
}

const STAGES = ['Group', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final']

interface Poll {
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
}

export default function MatchProvisioner({ onSaved }: Props) {
  const supabase = createClient()
  const [teams, setTeams] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Match form state
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [kickoffTime, setKickoffTime] = useState('')
  const [stage, setStage] = useState('Group')
  const [polls, setPolls] = useState<Poll[]>([])

  // Team management
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamEmoji, setNewTeamEmoji] = useState('🏴')
  const [newTeamGroup, setNewTeamGroup] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)
  const [showTeamForm, setShowTeamForm] = useState(false)

  useEffect(() => {
    supabase.from('teams').select('*').order('name').then(({ data }) => setTeams(data || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addPoll = () => {
    setPolls(prev => [...prev, { question: '', option_a: '', option_b: '', option_c: '', option_d: '' }])
  }

  const updatePoll = (i: number, field: keyof Poll, value: string) => {
    setPolls(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  const removePoll = (i: number) => {
    setPolls(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return
    setAddingTeam(true)
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: newTeamName.trim(), flag_emoji: newTeamEmoji, group_letter: newTeamGroup || null })
      .select()
      .single()
    if (data) {
      setTeams(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTeamName('')
      setNewTeamEmoji('🏴')
      setNewTeamGroup('')
      setShowTeamForm(false)
    }
    setAddingTeam(false)
  }

  const handleSave = async () => {
    if (!homeTeamId || !awayTeamId || !kickoffTime) {
      setError('Please fill all required fields.')
      return
    }
    if (homeTeamId === awayTeamId) {
      setError('Home and Away teams must be different.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          home_team_id: parseInt(homeTeamId),
          away_team_id: parseInt(awayTeamId),
          kickoff_time: new Date(kickoffTime).toISOString(),
          stage,
        })
        .select()
        .single()

      if (matchError) throw matchError

      if (polls.length > 0 && match) {
        const { error: pollError } = await supabase.from('custom_polls').insert(
          polls
            .filter(p => p.question && [p.option_a, p.option_b, p.option_c, p.option_d].filter(opt => opt && opt.trim() !== '').length > 1)
            .map(p => ({ ...p, match_id: match.id }))
        )
        if (pollError) throw pollError
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      setHomeTeamId(''); setAwayTeamId(''); setKickoffTime(''); setStage('Group'); setPolls([])
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Team Manager */}
      <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>National Teams ({teams.length})</h3>
          <button className="btn btn-ghost btn-sm" id="toggle-team-form-btn" onClick={() => setShowTeamForm(!showTeamForm)}>
            <Plus size={13} /> Add Team
          </button>
        </div>

        {showTeamForm && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px auto', gap: '10px', alignItems: 'end' }}>
            <div>
              <label className="form-label">Team Name</label>
              <input className="form-input" placeholder="e.g. Argentina" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} id="team-name-input" />
            </div>
            <div>
              <label className="form-label">Flag 🏴</label>
              <input className="form-input" placeholder="🇦🇷" value={newTeamEmoji} onChange={e => setNewTeamEmoji(e.target.value)} id="team-emoji-input" />
            </div>
            <div>
              <label className="form-label">Group</label>
              <input className="form-input" placeholder="A" maxLength={1} value={newTeamGroup} onChange={e => setNewTeamGroup(e.target.value.toUpperCase())} id="team-group-input" />
            </div>
            <button className="btn btn-success" id="save-team-btn" onClick={handleAddTeam} disabled={addingTeam}>
              {addingTeam ? <Loader2 size={14} /> : <CheckCircle size={14} />}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {teams.map(t => (
            <span key={t.id} className="badge badge-gray" style={{ fontSize: '12px', padding: '4px 10px' }}>
              {t.flag_emoji} {t.name}
            </span>
          ))}
          {teams.length === 0 && <p className="text-muted" style={{ fontSize: '13px' }}>No teams yet. Add teams first.</p>}
        </div>
      </div>

      {/* Match Form */}
      <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Add New Match</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label className="form-label" htmlFor="home-team-select">Home Team *</label>
            <select id="home-team-select" className="form-select" value={homeTeamId} onChange={e => setHomeTeamId(e.target.value)}>
              <option value="">Select team...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.flag_emoji} {t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="away-team-select">Away Team *</label>
            <select id="away-team-select" className="form-select" value={awayTeamId} onChange={e => setAwayTeamId(e.target.value)}>
              <option value="">Select team...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.flag_emoji} {t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="kickoff-input">Kickoff Time *</label>
            <input id="kickoff-input" type="datetime-local" className="form-input" value={kickoffTime} onChange={e => setKickoffTime(e.target.value)} />
          </div>
          <div>
            <label className="form-label" htmlFor="stage-select">Stage *</label>
            <select id="stage-select" className="form-select" value={stage} onChange={e => setStage(e.target.value)}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Custom Polls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label className="form-label" style={{ margin: 0 }}>
              <HelpCircle size={13} style={{ display: 'inline', marginRight: '6px' }} />
              Bonus MCQ Questions ({polls.length})
            </label>
            <button className="btn btn-ghost btn-sm" id="add-poll-btn" onClick={addPoll}>
              <Plus size={13} /> Add Question
            </button>
          </div>

          {polls.map((poll, i) => (
            <div key={i} className="bento-card" style={{ background: 'var(--surface-raised)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Question {i + 1}</span>
                <button className="btn btn-danger btn-sm btn-icon" id={`remove-poll-${i}`} onClick={() => removePoll(i)}>
                  <Trash2 size={12} />
                </button>
              </div>
              <input className="form-input" placeholder="Question text..." value={poll.question} onChange={e => updatePoll(i, 'question', e.target.value)} id={`poll-${i}-question`} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(['option_a', 'option_b', 'option_c', 'option_d'] as const).map((key, oi) => (
                  <input key={key} className="form-input" placeholder={`Option ${String.fromCharCode(65 + oi)}`} value={poll[key]} onChange={e => updatePoll(i, key, e.target.value)} id={`poll-${i}-${key}`} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="login-error"><span style={{ fontSize: '13px' }}>{error}</span></div>}

        <button id="save-match-btn" className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving...</>
            : saved ? <><CheckCircle size={15} /> Match Added!</>
            : <><Plus size={15} /> Schedule Match</>}
        </button>
      </div>
    </div>
  )
}
