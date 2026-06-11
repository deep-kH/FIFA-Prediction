'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, Trash2, Loader2 } from 'lucide-react'

export default function SquadManager() {
  const supabase = createClient()
  const [teams, setTeams] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerPosition, setNewPlayerPosition] = useState('Forward')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const POSITIONS = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper']

  useEffect(() => {
    supabase.from('teams').select('*').order('name').then(({ data }) => setTeams(data || []))
  }, [])

  useEffect(() => {
    if (!selectedTeamId) { setPlayers([]); return }
    supabase.from('players').select('*').eq('team_id', selectedTeamId).order('name')
      .then(({ data }) => setPlayers(data || []))
  }, [selectedTeamId])

  const handleAdd = async () => {
    if (!selectedTeamId || !newPlayerName.trim()) return
    setAdding(true)
    const { data } = await supabase.from('players')
      .insert({ name: newPlayerName.trim(), team_id: parseInt(selectedTeamId), position: newPlayerPosition })
      .select().single()
    if (data) { setPlayers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name))); setNewPlayerName('') }
    setAdding(false)
  }

  const handleDelete = async (id: number) => {
    setDeleting(id)
    await supabase.from('players').delete().eq('id', id)
    setPlayers(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  const selectedTeam = teams.find(t => t.id === parseInt(selectedTeamId))

  return (
    <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Player Squad Management</h3>
      <div>
        <label className="form-label" htmlFor="squad-team-select">Select Team</label>
        <select id="squad-team-select" className="form-select" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>
          <option value="">Choose a team...</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.flag_emoji} {t.name}</option>)}
        </select>
      </div>
      {selectedTeamId && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: '10px', alignItems: 'end' }}>
            <div>
              <label className="form-label" htmlFor="player-name-input">Player Name</label>
              <input id="player-name-input" className="form-input" placeholder="e.g. Lionel Messi" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            </div>
            <div>
              <label className="form-label">Position</label>
              <select className="form-select" value={newPlayerPosition} onChange={e => setNewPlayerPosition(e.target.value)}>
                {POSITIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" id="add-player-btn" onClick={handleAdd} disabled={adding || !newPlayerName.trim()}>
              {adding ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Plus size={14} />}
            </button>
          </div>
          <div className="divider" style={{ margin: '0' }} />
          <p style={{ fontSize: '13px', fontWeight: 700 }}>{selectedTeam?.flag_emoji} {selectedTeam?.name} — {players.length} players</p>
          {players.length === 0 && <p className="text-muted" style={{ fontSize: '13px' }}>No players yet.</p>}
          {players.map(player => (
            <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--surface-raised)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{player.name}</span>
              <span className="badge badge-gray" style={{ fontSize: '10px' }}>{player.position}</span>
              <button className="btn btn-danger btn-sm btn-icon" id={`delete-player-${player.id}`} onClick={() => handleDelete(player.id)} disabled={deleting === player.id}>
                {deleting === player.id ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Trash2 size={12} />}
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
