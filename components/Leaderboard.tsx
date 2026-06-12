'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, TrendingUp, TrendingDown, Minus, Shield } from 'lucide-react'

interface LeaderboardEntry {
  id: string
  display_name: string
  avatar_letter: string
  total_points: number
  is_admin?: boolean
  current_streak?: number
}

interface Props {
  entries: LeaderboardEntry[]
  currentUserId: string
  onProfileClick: (user: LeaderboardEntry) => void
}

const MEDAL_COLORS = ['#F5C842', '#C0C0C0', '#CD7F32']
const MEDAL_EMOJIS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ entries, currentUserId, onProfileClick }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Trophy size={22} color="var(--cup-gold)" />
        <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Live Standings</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <span className="status-dot status-live" />
          <span style={{ fontSize: '12px', color: 'var(--cup-red)', fontWeight: 600 }}>Live</span>
        </div>
      </div>

      {/* Top 3 Podium */}
      {entries.length >= 3 && (
        <div className="podium-row">
          {/* 2nd place */}
          <PodiumCard entry={entries[1]} rank={2} isCurrentUser={entries[1]?.id === currentUserId} onClick={() => onProfileClick(entries[1])} />
          {/* 1st place */}
          <PodiumCard entry={entries[0]} rank={1} isCurrentUser={entries[0]?.id === currentUserId} onClick={() => onProfileClick(entries[0])} />
          {/* 3rd place */}
          <PodiumCard entry={entries[2]} rank={3} isCurrentUser={entries[2]?.id === currentUserId} onClick={() => onProfileClick(entries[2])} />
        </div>
      )}

      {/* Full Leaderboard */}
      <div className="bento-card" style={{ padding: '8px' }}>
        <AnimatePresence initial={false}>
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              layout
              layoutId={entry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <LeaderboardRow
                entry={entry}
                rank={i + 1}
                isCurrentUser={entry.id === currentUserId}
                onClick={() => onProfileClick(entry)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {entries.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No participants yet.
          </div>
        )}
      </div>

      <style jsx>{`
        .podium-row {
          display: grid;
          grid-template-columns: 1fr 1.2fr 1fr;
          gap: 12px;
          align-items: end;
        }
      `}</style>
    </div>
  )
}

export function StreakFlame({ streak }: { streak?: number }) {
  if (!streak || streak < 2) return null;
  let color = 'var(--cup-red)';
  if (streak >= 20) color = 'var(--cup-gold)';
  else if (streak >= 10) color = '#C0C0C0'; // Silver

  return (
    <span title={`${streak} Match Streak!`} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      marginLeft: '6px',
      padding: '1px 5px',
      borderRadius: '8px',
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      color: color,
      fontSize: '11px',
      fontWeight: 800,
      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`
    }}>
      🔥 {streak}
    </span>
  )
}

function PodiumCard({ entry, rank, isCurrentUser, onClick }: {
  entry: LeaderboardEntry; rank: number; isCurrentUser: boolean; onClick: () => void
}) {
  if (!entry) return <div />
  return (
    <button
      id={`podium-${rank}`}
      onClick={onClick}
      style={{
        background: rank === 1 ? 'rgba(245,200,66,0.08)' : 'var(--surface-card)',
        border: `1px solid ${rank === 1 ? 'rgba(245,200,66,0.3)' : 'var(--border-subtle)'}`,
        borderRadius: '16px',
        padding: rank === 1 ? '20px 16px' : '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
        width: '100%',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <span style={{ fontSize: rank === 1 ? '28px' : '22px' }}>{MEDAL_EMOJIS[rank - 1]}</span>
      <div style={{
        width: rank === 1 ? '52px' : '44px',
        height: rank === 1 ? '52px' : '44px',
        borderRadius: '50%',
        background: MEDAL_COLORS[rank - 1],
        color: '#0A0C10',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: rank === 1 ? '22px' : '18px',
        fontWeight: 900,
        border: isCurrentUser ? '3px solid var(--cup-gold)' : 'none',
      }}>
        {entry.avatar_letter}
      </div>
      <p style={{ fontSize: '13px', fontWeight: 700, textAlign: 'center', color: 'var(--text-primary)' }}>
        {entry.display_name}
        <StreakFlame streak={entry.current_streak} />
        {isCurrentUser && <span style={{ color: 'var(--cup-gold)' }}> ·You</span>}
      </p>
      <div className="badge badge-gold" style={{ fontSize: '13px', padding: '4px 12px' }}>
        {Number(entry.total_points || 0).toFixed(2)} pts
      </div>
    </button>
  )
}

function LeaderboardRow({ entry, rank, isCurrentUser, onClick }: {
  entry: LeaderboardEntry; rank: number; isCurrentUser: boolean; onClick: () => void
}) {
  const isTop3 = rank <= 3
  return (
    <button
      id={`leaderboard-row-${rank}`}
      className="lb-row"
      onClick={onClick}
      style={{ width: '100%', background: isCurrentUser ? 'rgba(245,200,66,0.05)' : 'transparent', border: `1px solid ${isCurrentUser ? 'rgba(245,200,66,0.2)' : 'transparent'}` }}
    >
      <span className={`lb-rank ${isTop3 ? `lb-rank-${rank}` : ''}`}>
        {rank <= 3 ? MEDAL_EMOJIS[rank - 1] : rank}
      </span>

      <div className="lb-avatar" style={{
        background: isCurrentUser ? 'var(--cup-gold)' : 'var(--surface-overlay)',
        color: isCurrentUser ? '#0A0C10' : 'var(--text-primary)',
        borderColor: isCurrentUser ? 'var(--cup-gold)' : 'var(--border-default)',
        fontWeight: 800,
      }}>
        {entry.avatar_letter}
      </div>

      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <p style={{ fontSize: '14px', fontWeight: isCurrentUser ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.display_name}
          <StreakFlame streak={entry.current_streak} />
          {isCurrentUser && <span style={{ color: 'var(--cup-gold)', marginLeft: '6px', fontSize: '12px' }}>You</span>}
          {entry.is_admin && <span style={{ marginLeft: '6px' }}><Shield size={11} color="var(--cup-blue)" /></span>}
        </p>
      </div>

      <div className={`badge ${isTop3 ? 'badge-gold' : 'badge-gray'}`} style={{ fontSize: '13px', padding: '4px 12px' }}>
        {Number(entry.total_points || 0).toFixed(2)} pts
      </div>
    </button>
  )
}
