'use client'

import { useState } from 'react'
import { Shield, Plus, Users, CheckSquare, Settings } from 'lucide-react'
import MatchProvisioner from './MatchProvisioner'
import SquadManager from './SquadManager'
import SettlementConsole from './SettlementConsole'

interface Props {
  matches: any[]
  onDataChanged: () => void
}

type AdminTab = 'schedule' | 'squad' | 'settle'

export default function AdminPanel({ matches, onDataChanged }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('schedule')

  const tabs = [
    { id: 'schedule' as AdminTab, label: 'Match Schedule', icon: <Plus size={15} /> },
    { id: 'squad' as AdminTab, label: 'Squad Manager', icon: <Users size={15} /> },
    { id: 'settle' as AdminTab, label: 'Settle Results', icon: <CheckSquare size={15} /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Admin Header */}
      <div className="bento-card" style={{ background: 'rgba(66,133,244,0.06)', borderColor: 'rgba(66,133,244,0.2)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Shield size={18} color="var(--cup-blue)" />
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Admin Control Center</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Manage the tournament — matches, squads, and settlements.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="admin-tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`admin-tab-${tab.id}`}
            className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'schedule' && <MatchProvisioner onSaved={onDataChanged} />}
        {activeTab === 'squad' && <SquadManager />}
        {activeTab === 'settle' && <SettlementConsole matches={matches} onSettled={onDataChanged} />}
      </div>

      <style jsx>{`
        .admin-tab-bar {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 0;
        }
        .admin-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border: none;
          background: none;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
          margin-bottom: -1px;
        }
        .admin-tab-btn:hover { color: var(--text-primary); }
        .admin-tab-btn.active {
          color: var(--cup-gold);
          border-bottom-color: var(--cup-gold);
        }
      `}</style>
    </div>
  )
}
