'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Profile, Match, Ballot, PollAnswer } from '@/types/database'
import Leaderboard, { StreakFlame } from '@/components/Leaderboard'
import BallotCard from '@/components/BallotCard'
import AdminPanel from '@/components/admin/AdminPanel'
import ThemeToggle from '@/components/ThemeToggle'
import {
  Trophy, LogOut, Shield, Zap, Pencil,
  ChevronDown, ChevronUp, User, BarChart2, X, Trash2
} from 'lucide-react'

interface Props {
  profile: Profile
  matches: any[]
  leaderboard: any[]
  userBallots: Ballot[]
  userPollAnswers: PollAnswer[]
}

export default function DashboardClient({
  profile, matches, leaderboard: initialLeaderboard,
  userBallots, userPollAnswers
}: Props) {
  const [activeTab, setActiveTab] = useState<'matches' | 'leaderboard' | 'admin'>('matches')
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard)
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null)
  const [ballots, setBallots] = useState<Ballot[]>(userBallots)
  const [pollAnswers, setPollAnswers] = useState<PollAnswer[]>(userPollAnswers)
  const [profileModalUser, setProfileModalUser] = useState<any | null>(null)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [showWildcardInfo, setShowWildcardInfo] = useState(false)
  const [showStreakInfo, setShowStreakInfo] = useState(false)
  const [currentProfile, setCurrentProfile] = useState(profile)

  const supabase = createClient()

  // Sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Real-time leaderboard subscription
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          setLeaderboard(prev => {
            const updated = prev.map(p =>
              p.id === payload.new.id ? { ...p, ...payload.new } : p
            )
            return [...updated].sort((a, b) => b.total_points - a.total_points)
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const selectedMatch = matches.find(m => m.id === selectedMatchId)
  const userBallotForMatch = ballots.find(b => b.match_id === selectedMatchId)
  const userPollAnswersForMatch = pollAnswers.filter(pa =>
    selectedMatch?.custom_polls?.some((cp: any) => cp.id === pa.poll_id)
  )

  const upcomingMatches = matches.filter(m => !m.is_completed)
  const completedMatches = matches.filter(m => m.is_completed)

  const handleBallotSaved = (ballot: Ballot) => {
    setBallots(prev => {
      const exists = prev.findIndex(b => b.id === ballot.id)
      if (exists >= 0) {
        const updated = [...prev]
        updated[exists] = ballot
        return updated
      }
      return [...prev, ballot]
    })
    setSelectedMatchId(null)
  }

  const handleProfileUpdated = (updatedProfile: any) => {
    setCurrentProfile(updatedProfile)
    // Also update leaderboard optimistically if they are in it
    setLeaderboard(prev => {
      const exists = prev.findIndex((p: any) => p.id === updatedProfile.id)
      if (exists >= 0) {
        const arr = [...prev]
        arr[exists] = { ...arr[exists], ...updatedProfile }
        return arr
      }
      return prev
    })
  }

  const handlePollAnswerSaved = (answer: PollAnswer) => {
    setPollAnswers(prev => {
      const exists = prev.findIndex(pa => pa.id === answer.id)
      if (exists >= 0) {
        const updated = [...prev]
        updated[exists] = answer
        return updated
      }
      return [...prev, answer]
    })
  }

  return (
    <div className="dashboard-layout">
      {/* ─── TOP NAV ─── */}
      <header className="dashboard-topnav">
        <div className="topnav-header">
          {/* Logo */}
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Trophy size={20} color="#0A0C10" strokeWidth={2.5} />
            </div>
            <div>
              <span className="sidebar-logo-text font-display" style={{ fontSize: '18px' }}>TACT-IX</span>
            </div>
          </div>

          {/* Controls: Profile, Theme Toggle, Sign Out */}
          <div className="topnav-controls" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Wildcard Inventory */}
            <button
              onClick={() => setShowWildcardInfo(true)}
              title="View Wildcard Rules"
              style={{
                display: 'flex', gap: '8px', fontSize: '13px', fontWeight: 800, padding: '4px 12px',
                background: 'var(--surface-overlay)', borderRadius: '20px', border: '1px solid var(--border-subtle)',
                cursor: 'pointer', transition: 'all 0.2s', alignItems: 'center'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            >
              <span style={{ display: 'flex', gap: '4px', alignItems: 'center', color: 'var(--cup-red)' }}>
                🔥 {currentProfile.inventory_multiplier || 0}
              </span>
              <span style={{ color: 'var(--border-strong)' }}>|</span>
              <span style={{ display: 'flex', gap: '4px', alignItems: 'center', color: 'var(--cup-gold)' }}>
                🛡️ {currentProfile.inventory_safety || 0}
              </span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setShowStreakInfo(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title="View Streak Rules"
              >
                <StreakFlame streak={currentProfile.current_streak} />
              </button>
              <button
                onClick={() => setShowProfileEdit(true)}
                className="sidebar-avatar"
                style={{ width: '32px', height: '32px', fontSize: '14px', cursor: 'pointer', border: 'none', padding: 0 }}
                title="Edit Profile"
              >
                {currentProfile.avatar_letter}
              </button>
            </div>
            <ThemeToggle />
            <button className="btn btn-ghost btn-icon" onClick={handleSignOut} title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Nav Tabs (Pills) */}
        <nav className="topnav-nav">
          {[
            { id: 'matches', label: 'Match Ballots', icon: <Zap size={14} /> },
            { id: 'leaderboard', label: 'Standings', icon: <BarChart2 size={14} /> },
            ...(profile.is_admin ? [{ id: 'admin', label: 'Admin Center', icon: <Shield size={14} /> }] : []),
          ].map(tab => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              className={`topnav-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="dashboard-main">
        {activeTab === 'matches' && (
          <MatchesTab
            matches={matches}
            selectedMatchId={selectedMatchId}
            setSelectedMatchId={setSelectedMatchId}
            selectedMatch={selectedMatch}
            profile={currentProfile}
            userBallot={userBallotForMatch}
            userPollAnswers={userPollAnswersForMatch}
            allBallots={ballots}
            allPollAnswers={pollAnswers}
            onBallotSaved={handleBallotSaved}
            onPollAnswerSaved={handlePollAnswerSaved}
            onProfileUpdated={handleProfileUpdated}
            leaderboard={leaderboard}
          />
        )}

        {activeTab === 'leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="bento-card" style={{ padding: '16px 20px', background: 'rgba(255, 215, 0, 0.05)', borderColor: 'rgba(255, 215, 0, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 12px 0' }}>
                <Zap size={18} color="var(--cup-gold)" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--cup-gold)', margin: 0 }}>Scoring Rules</h3>
              </div>
              <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <li><strong>Exact Scoreline:</strong> +5 pts <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>(exclusive — no outcome double-dip)</span></li>
                <li><strong>Correct Match Outcome</strong> (Win/Draw/Loss, wrong score): +2 pts</li>
                <li><strong>Home Team Goals Match:</strong> +1 pt <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>(consolation if you nail a team&apos;s goals)</span></li>
                <li><strong>Away Team Goals Match:</strong> +1 pt</li>
                <li><strong>Correct PLayer of the Match:</strong> +3 pts</li>
                <li><strong>Bonus MCQ Polls:</strong> +2 pts per correct answer</li>
              </ul>
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-default)' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cup-gold)', marginBottom: '4px' }}>🎯 Accuracy Rate Bonus</p>
                <ul style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <li><strong>Tier 1</strong> (80%–100% accuracy): +5 bonus pts</li>
                  <li><strong>Tier 2</strong> (50%–79% accuracy): +2 bonus pts</li>
                  <li><strong>Tier 3</strong> (&lt;50% accuracy): +0 bonus pts</li>
                </ul>
              </div>
            </div>
            <Leaderboard
              entries={leaderboard}
              currentUserId={profile.id}
              onProfileClick={setProfileModalUser}
            />
          </div>
        )}

        {activeTab === 'admin' && profile.is_admin && (
          <AdminPanel
            matches={matches}
            onDataChanged={() => window.location.reload()}
          />
        )}
      </main>

      {/* Profile Modal */}
      {profileModalUser && (
        <ProfileModal
          user={profileModalUser}
          currentUserId={currentProfile.id}
          allBallots={ballots}
          allPollAnswers={pollAnswers}
          matches={matches}
          onClose={() => setProfileModalUser(null)}
        />
      )}

      {/* Profile Edit Modal */}
      {showProfileEdit && (
        <ProfileEditModal
          profile={currentProfile}
          onClose={() => setShowProfileEdit(false)}
          onSaved={(updated: Profile) => {
            setCurrentProfile(updated)
            setLeaderboard(prev => prev.map(p => p.id === updated.id ? { ...p, display_name: updated.display_name, avatar_letter: updated.avatar_letter } : p))
            setShowProfileEdit(false)
          }}
        />
      )}

      {/* Wildcard Info Modal */}
      {showWildcardInfo && <WildcardInfoModal onClose={() => setShowWildcardInfo(false)} />}
      {showStreakInfo && <StreakInfoModal onClose={() => setShowStreakInfo(false)} />}

      <style jsx>{`
        .dashboard-layout {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          background: var(--surface-base);
        }
        .dashboard-topnav {
          background: var(--surface-card);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          padding: 16px 24px;
          position: sticky;
          top: 0;
          z-index: 50;
          gap: 16px;
        }
        .topnav-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .topnav-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .topnav-nav {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .topnav-nav::-webkit-scrollbar {
          height: 4px;
        }
        .topnav-nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid transparent;
          background: var(--surface-raised);
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        .topnav-nav-item:hover {
          background: rgba(245,200,66,0.1);
          color: var(--text-primary);
        }
        .topnav-nav-item.active {
          background: var(--cup-gold);
          color: #0A0C10;
          border-color: var(--cup-gold);
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sidebar-logo-icon {
          width: 38px; height: 38px;
          background: var(--cup-gold);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-logo-text {
          font-size: 20px;
          color: var(--text-primary);
          display: block;
          line-height: 1;
        }
        .sidebar-logo-sub {
          font-size: 10px;
          color: var(--text-muted);
          display: block;
          letter-spacing: 0.05em;
        }
        .sidebar-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--surface-raised);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 10px 12px;
        }
        .sidebar-avatar {
          width: 38px; height: 38px;
          background: #ffffff;
          color: #000000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .sidebar-profile-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .sidebar-profile-name {
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dashboard-main {
          flex: 1;
          padding: 24px;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }
        @media (max-width: 768px) {
          .dashboard-topnav { padding: 12px 16px; gap: 12px; }
          .dashboard-main { padding: 16px; }
        }
      `}</style>
    </div>
  )
}

// ─── MATCHES TAB ───────────────────────────────────────────
function MatchesTab({ matches, selectedMatchId, setSelectedMatchId, profile, allBallots, allPollAnswers, onBallotSaved, onPollAnswerSaved, onProfileUpdated, leaderboard }: any) {
  const [showCompleted, setShowCompleted] = useState(false)
  const upcoming = matches.filter((m: any) => !m.is_completed)
  const completed = matches.filter((m: any) => m.is_completed)
  const selectedMatch = matches.find((m: any) => m.id === selectedMatchId)

  const toggleMatch = (matchId: number) => {
    setSelectedMatchId(selectedMatchId === matchId ? null : matchId)
  }

  const handleShareMatch = async (e: any, match: any) => {
    e.stopPropagation();
    const emojis = ['🥇', '🥈', '🥉'];
    const top3 = leaderboard.slice(0, 3).map((l: any, i: number) => `${emojis[i]} ${l.display_name} (${Number(l.total_points).toFixed(2)} pts),`).join('\n');
    const text = `Predict the FIFA World Cup match between *${match.home_team?.name}* and *${match.away_team?.name}* on TACT-IX!\n\nThe current leaders are:\n${top3}\n\nPredict now at ${window.location.origin}/match/${match.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'TACT-IX Match Prediction', text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Share message copied to clipboard!');
      }
    } catch (err) {
      console.log('Share canceled or failed', err);
    }
  }

  const handleDeleteMatch = async (e: any, match: any) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to completely erase the match between ${match.home_team?.name} and ${match.away_team?.name}? This will permanently delete all polls and ballots associated with it!`)) return;

    try {
      const supabase = createClient();
      const { error } = await supabase.from('matches').delete().eq('id', match.id);
      if (error) throw error;
      alert('Match deleted successfully.');
      window.location.reload();
    } catch (err: any) {
      alert(`Error deleting match: ${err.message}`);
    }
  }

  const renderMatchCard = (match: any) => {
    const isExpanded = selectedMatchId === match.id
    const kickoff = new Date(match.kickoff_time)
    const isLocked = new Date() >= kickoff
    const isCompleted = match.is_completed
    const myBallot = allBallots.find((b: any) => b.match_id === match.id && b.user_id === profile.id)
    const hasBallot = !!myBallot

    // Determine card visual state
    const cardState = isCompleted ? 'completed' : hasBallot ? 'submitted' : 'pending'

    return (
      <button key={match.id} className={`match-card ${cardState} ${isExpanded ? 'active' : ''}`} onClick={() => toggleMatch(match.id)}>
        {/* Left accent bar */}
        <div className={`match-card-accent ${cardState}`} />

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Teams row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{match.home_team?.flag_emoji} {match.home_team?.name}</span>
              <span className="font-score" style={{ fontSize: '18px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                {isCompleted ? `${match.home_score} – ${match.away_score}` : 'vs'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, textAlign: 'right' }}>{match.away_team?.name} {match.away_team?.flag_emoji}</span>
            </div>
          </div>

          {/* Meta row: date, stage, status badges */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }} suppressHydrationWarning>
              {kickoff.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })} · {kickoff.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST
            </span>
            {match.stage && <span className="badge badge-gray" style={{ fontSize: '9px' }}>{match.stage}</span>}
            {isCompleted && <span className="badge badge-gray" style={{ fontSize: '9px' }}>FT</span>}
            {isLocked && !isCompleted && <span className="badge badge-red" style={{ fontSize: '9px' }}>Locked</span>}
            {!isLocked && hasBallot && <span className="badge badge-green" style={{ fontSize: '9px' }}>✓</span>}
            {!isLocked && !hasBallot && !isCompleted && <span className="badge badge-red" style={{ fontSize: '9px' }}>Pending</span>}

            {profile.is_admin && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                <button
                  onClick={(e) => handleShareMatch(e, match)}
                  className="btn btn-ghost btn-sm"
                  title="Share Match"
                  style={{ padding: '0 6px', height: '24px', minHeight: '24px', fontSize: '12px' }}
                >
                  Share
                </button>
                {!isLocked && (
                  <button
                    onClick={(e) => handleDeleteMatch(e, match)}
                    className="btn btn-ghost btn-sm"
                    title="Delete Match"
                    style={{ padding: '0 6px', height: '24px', minHeight: '24px', color: 'var(--cup-red)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Predicted / Actual scores */}
          {hasBallot && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '2px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Your prediction: <span className="font-score" style={{ fontSize: '16px', color: 'var(--cup-gold)', letterSpacing: '1px' }}>{myBallot.predicted_home_score} – {myBallot.predicted_away_score}</span>
              </span>
              {isCompleted && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  · Result: <span className="font-score" style={{ fontSize: '16px', color: 'var(--text-primary)', letterSpacing: '1px' }}>{match.home_score} – {match.away_score}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side: edit icon + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {!isLocked && hasBallot && (
            <Pencil size={14} color="var(--cup-green)" />
          )}
        </div>
      </button>
    )
  }

  const renderSelectedMatchDetails = () => {
    const match = selectedMatch
    if (!match) return null
    const myBallot = allBallots.find((b: any) => b.match_id === match.id && b.user_id === profile.id)
    const myPollAnswers = allPollAnswers.filter((pa: any) =>
      match.custom_polls?.some((cp: any) => cp.id === pa.poll_id) && pa.user_id === profile.id
    )
    return (
      <div className="selected-match-details">
        <BallotCard
          key={match.id}
          match={match}
          profile={profile}
          existingBallot={myBallot}
          existingPollAnswers={myPollAnswers}
          allBallots={allBallots}
          allPollAnswers={allPollAnswers}
          onBallotSaved={onBallotSaved}
          onPollAnswerSaved={onPollAnswerSaved}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Match Ballots</h2>
        <span className="badge badge-green">{upcoming.length} Upcoming</span>
      </div>

      <div className="match-grid">
        {upcoming.map(renderMatchCard)}
      </div>

      {selectedMatch && !selectedMatch.is_completed && renderSelectedMatchDetails()}

      {completed.length > 0 && (
        <>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', marginTop: '4px' }}
            onClick={() => setShowCompleted(!showCompleted)}
            id="toggle-completed-btn"
          >
            {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {completed.length} Completed Matches
          </button>
          {showCompleted && (
            <div className="match-grid">
              {completed.map(renderMatchCard)}
            </div>
          )}
          {showCompleted && selectedMatch && selectedMatch.is_completed && renderSelectedMatchDetails()}
        </>
      )}
      <style jsx global>{`
        .match-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 12px;
        }
        @media (max-width: 500px) {
          .match-grid { grid-template-columns: 1fr; }
        }
        .match-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
          padding: 16px 18px;
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          background: var(--surface-card);
          overflow: hidden;
          transition: all 0.2s ease;
          position: relative;
          text-align: left;
          color: var(--text-primary);
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .match-card:hover {
          background: var(--surface-raised);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          transform: translateY(-2px);
        }
        .match-card.submitted {
          border: 1px solid var(--cup-green);
          background-color: var(--surface-card);
          box-shadow: inset 0 0 40px rgba(57, 255, 20, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          animation: pulseSubmittedBorder 4s infinite ease-in-out;
        }
        .match-card.pending {
          border: 1px solid var(--cup-red);
          background-color: var(--surface-card);
          box-shadow: inset 0 0 40px rgba(255, 49, 49, 0.1), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          animation: pulsePendingBorder 4s infinite ease-in-out;
        }
        .match-card.completed {
          border-color: var(--border-subtle);
          background-color: var(--surface-card);
          opacity: 0.8;
          box-shadow: none;
        }
        .match-card.completed:hover {
          opacity: 1;
          transform: none;
        }
        .match-card.active {
          border: 1px solid var(--cup-gold);
          background-color: var(--surface-card);
          box-shadow: inset 0 0 50px rgba(255, 215, 0, 0.15), 0 0 0 1px rgba(255, 215, 0, 0.4), 0 8px 25px rgba(255, 215, 0, 0.15);
          opacity: 1;
          transform: none;
          animation: pulseActiveBorder 2.5s infinite ease-in-out;
        }
        @keyframes pulsePendingBorder {
          0% { border-color: rgba(255, 49, 49, 0.3); }
          50% { border-color: rgba(255, 49, 49, 0.8); }
          100% { border-color: rgba(255, 49, 49, 0.3); }
        }
        @keyframes pulseSubmittedBorder {
          0% { border-color: rgba(57, 255, 20, 0.4); }
          50% { border-color: rgba(57, 255, 20, 0.9); }
          100% { border-color: rgba(57, 255, 20, 0.4); }
        }
        @keyframes pulseActiveBorder {
          0% { border-color: rgba(255, 215, 0, 0.6); box-shadow: inset 0 0 50px rgba(255, 215, 0, 0.15), 0 0 0 1px rgba(255, 215, 0, 0.3), 0 8px 25px rgba(255, 215, 0, 0.15); }
          50% { border-color: rgba(255, 215, 0, 1); box-shadow: inset 0 0 50px rgba(255, 215, 0, 0.25), 0 0 0 2px rgba(255, 215, 0, 0.6), 0 8px 30px rgba(255, 215, 0, 0.25); }
          100% { border-color: rgba(255, 215, 0, 0.6); box-shadow: inset 0 0 50px rgba(255, 215, 0, 0.15), 0 0 0 1px rgba(255, 215, 0, 0.3), 0 8px 25px rgba(255, 215, 0, 0.15); }
        }
        .match-card-accent {
          width: 4px;
          min-height: 40px;
          border-radius: 4px;
          flex-shrink: 0;
          align-self: stretch;
        }
        .match-card-accent.submitted {
          background: var(--cup-green);
        }
        .match-card-accent.pending {
          background: var(--cup-red);
          opacity: 0.5;
        }
        .match-card-accent.completed {
          background: var(--text-muted);
          opacity: 0.3;
        }
        .selected-match-details {
          margin-top: 8px;
          animation: slideDown 0.3s ease-out;
        }
        .selected-match-details :global(.bento-card) {
          border: 2px solid var(--cup-gold);
          animation: pulseActiveBorder 2.5s infinite ease-in-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}


// ─── PROFILE MODAL ─────────────────────────────────────────
function ProfileModal({ user, currentUserId, allBallots, allPollAnswers, matches, onClose }: any) {
  const userBallots = allBallots.filter((b: any) => b.user_id === user.id);
  const settledBallots = userBallots.filter((b: any) => {
    const m = matches.find((m: any) => m.id === b.match_id);
    return m && m.is_completed;
  }).sort((a: any, b: any) => {
    const ma = matches.find((m: any) => m.id === a.match_id);
    const mb = matches.find((m: any) => m.id === b.match_id);
    return new Date(mb.kickoff_time).getTime() - new Date(ma.kickoff_time).getTime();
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div className="lb-avatar" style={{ width: '52px', height: '52px', fontSize: '22px', background: 'var(--cup-gold)', color: '#0A0C10', borderColor: 'var(--cup-gold)' }}>
            {user.avatar_letter}
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>{user.display_name}</h2>
            {user.id === currentUserId && <span className="badge badge-gold">You</span>}
            {user.is_admin && <span className="badge badge-blue" style={{ marginLeft: '6px' }}><Shield size={9} /> Admin</span>}
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" style={{ marginLeft: 'auto' }} onClick={onClose}>✕</button>
        </div>
        <div className="bento-card" style={{ textAlign: 'center', padding: '20px', marginBottom: '20px' }}>
          <p style={{ fontSize: '40px', fontWeight: 900, color: 'var(--cup-gold)' }}>{Number(user.total_points || 0).toFixed(2)}</p>
          <p className="text-secondary" style={{ fontSize: '13px' }}>Total Fantasy Points</p>
        </div>

        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Prediction History</h3>
          {settledBallots.length === 0 ? (
            <p className="text-muted" style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
              No completed predictions yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {settledBallots.map((ballot: any) => {
                const match = matches.find((m: any) => m.id === ballot.match_id);
                const topScorerPts = (ballot.predicted_top_scorer_id && match?.top_scorer_id && ballot.predicted_top_scorer_id === match.top_scorer_id) ? 3 : 0;

                const matchPollIds = (match?.custom_polls || []).map((cp: any) => cp.id);
                const userAnswers = allPollAnswers?.filter((pa: any) => pa.user_id === user.id && matchPollIds.includes(pa.poll_id)) || [];
                const pollPts = userAnswers.reduce((acc: number, pa: any) => {
                  const poll = match?.custom_polls.find((cp: any) => cp.id === pa.poll_id);
                  if (poll && pa.selected_option === poll.correct_option) return acc + 2;
                  return acc;
                }, 0);

                return (
                  <div key={ballot.id} style={{ padding: '14px', background: 'var(--surface-base)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {match?.home_team?.flag_emoji} {match?.home_team?.name} vs {match?.away_team?.name} {match?.away_team?.flag_emoji}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>
                          Predicted: {ballot.predicted_home_score} - {ballot.predicted_away_score}
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px', fontSize: '12px' }}>
                            (Actual: {match?.home_score} - {match?.away_score})
                          </span>
                        </span>
                      </div>
                      <div className="badge badge-gold" style={{ fontSize: '13px', padding: '4px 12px', fontWeight: 800 }}>
                        +{Number(ballot.points_earned || 0).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {ballot.played_card === 'MULTIPLIER' && (
                        <span className="badge" style={{ background: 'var(--cup-red)', color: 'white', fontSize: '10px', padding: '2px 6px' }}>
                          🔥 {ballot.accuracy_rate >= 80 ? 'x2.0 Halal Bonus' : 'x0.75 Halal Penalty'}
                        </span>
                      )}
                      {ballot.played_card === 'SAFETY_NET' && (
                        <span className="badge badge-gold" style={{ fontSize: '10px', padding: '2px 6px', color: '#0A0C10' }}>
                          🛡️ Safety Net Applied
                        </span>
                      )}
                      {Number(ballot.score_points_earned || 0) > 0 && (
                        <span className="badge badge-green" style={{ fontSize: '10px', padding: '2px 6px' }}>
                          {Number(ballot.score_points_earned) === 5 ? 'Exact +5.00' : 'Outcome +2.00'}
                        </span>
                      )}
                      {(ballot.team_points_earned || 0) > 0 && (
                        <span className="badge badge-blue" style={{ fontSize: '10px', padding: '2px 6px' }}>
                          Team Goals +{ballot.team_points_earned}
                        </span>
                      )}
                      {topScorerPts > 0 && (
                        <span className="badge" style={{ background: '#8A2BE2', color: 'white', fontSize: '10px', padding: '2px 6px' }}>
                          POP +{topScorerPts.toFixed(2)}
                        </span>
                      )}
                      {pollPts > 0 && (
                        <span className="badge" style={{ background: '#FF4500', color: 'white', fontSize: '10px', padding: '2px 6px' }}>
                          Polls +{pollPts.toFixed(2)}
                        </span>
                      )}
                      {(ballot.accuracy_bonus_earned || 0) > 0 && (
                        <span className="badge badge-gold" style={{ fontSize: '10px', padding: '2px 6px' }}>
                          Bonus +{ballot.accuracy_bonus_earned}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── PROFILE EDIT MODAL ────────────────────────────────────
const EMOJI_OPTIONS = [
  '🧔🏻‍♂️', '🧔🏽‍♂️', '🧔🏿‍♂️', '👨🏻',
  '👨🏽', '👨🏿', '👦🏻', '👦🏽',
  '🕺', '🏃‍♂️', '🏃🏻‍♂️', '🏃🏽‍♂️',
  '🧑‍🦱', '🧑‍🦰', '🧑‍🦲', '🧑‍🦳',
  '🥷', '🦸‍♂️', '🦹‍♂️', '🤴',
  '🧙‍♂️', '🕴️', '😎', '🤩',
  '🥶', '😤', '🗿', '💀',
  '🔥', '⚡', '⭐', '👑',
  '💪', '🦁', '🐺', '🦅',
  '🐉', '🦈', '🚀', '🎩',
  '🧙‍♂️', '🧟‍♂️', '👨‍🦽‍➡️', '🙎‍♂️',
  '🗣', '🧞‍♂️', '🧑‍🎄', '🧑‍🏫'
];

function ProfileEditModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const supabase = createClient()
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [avatarEmoji, setAvatarEmoji] = useState(profile.avatar_letter)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const trimmed = displayName.trim()
    if (!trimmed || trimmed.length < 2) {
      setError('Display name must be at least 2 characters.')
      return
    }
    if (trimmed.length > 20) {
      setError('Display name must be at most 20 characters.')
      return
    }

    setSaving(true)
    setError(null)

    const { data, error: dbError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed, avatar_letter: avatarEmoji })
      .eq('id', profile.id)
      .select()
      .single()

    if (dbError) {
      setError(dbError.message)
      setSaving(false)
      return
    }

    onSaved(data as Profile)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Edit Profile</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Avatar Emoji Picker */}
        <div style={{ marginBottom: '20px' }}>
          <label className="form-label" style={{ marginBottom: '10px', display: 'block' }}>Choose Your Avatar</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', background: 'var(--cup-gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
              boxShadow: 'var(--glow-gold)', flexShrink: 0
            }}>
              {avatarEmoji}
            </div>
            <span className="text-muted" style={{ fontSize: '13px' }}>Tap an emoji below to change</span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px',
            background: 'var(--surface-raised)', borderRadius: '10px', padding: '10px',
            maxHeight: '160px', overflowY: 'auto'
          }}>
            {EMOJI_OPTIONS.map((emoji, index) => (
              <button
                key={`emoji-${index}`}
                onClick={() => setAvatarEmoji(emoji)}
                style={{
                  width: '32px', height: '32px', fontSize: '18px', background: avatarEmoji === emoji ? 'rgba(245,200,66,0.25)' : 'transparent',
                  border: avatarEmoji === emoji ? '2px solid var(--cup-gold)' : '2px solid transparent',
                  borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Display Name */}
        <div style={{ marginBottom: '16px' }}>
          <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Display Name</label>
          <input
            className="form-input"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={20}
            placeholder="Enter your display name"
            style={{ width: '100%' }}
          />
          <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>{displayName.length}/20 characters</p>
        </div>

        {error && (
          <p style={{ color: 'var(--cup-red)', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

function WildcardInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Tactical Wildcards
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Halal Ball */}
          <div style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(138,43,226,0.05), rgba(220,20,60,0.05))', borderRadius: '12px', border: '1px solid rgba(138,43,226,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '24px' }}>🔥</span>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--cup-red)' }}>The Halal Ball</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
              The ultimate high-risk, high-reward multiplier for when you are absolutely certain of an outcome.
            </p>
            <ul style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>How to Unlock:</strong> Hit a <strong>5-match prediction streak</strong>.</li>
              <li><strong>The Reward:</strong> If your prediction accuracy is <strong>&ge; 60%</strong>, your <strong>total points are doubled (2.0x)</strong>.</li>
              <li><strong>The Risk:</strong> If your accuracy is <strong>&le; 40%</strong>, you are penalized and receive only <strong>0.75x</strong> of your points!</li>
            </ul>
          </div>

          {/* Haram Ball */}
          <div style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(245,200,66,0.05), rgba(205,127,50,0.05))', borderRadius: '12px', border: '1px solid rgba(245,200,66,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '24px' }}>🛡️</span>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--cup-gold)' }}>The Haram Ball</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
              A massive points injection for chaotic, unpredictable knockout games.
            </p>
            <ul style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>How to Unlock:</strong> Achieved <em>exclusively</em> by hitting <strong>100% Accuracy</strong> on a single match.</li>
              <li><strong>The Reward:</strong> Automatically adds a flat <strong>+5.5 bonus points</strong> to your final score for that match!</li>
            </ul>
          </div>

          <div style={{ padding: '12px', background: 'var(--surface-overlay)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
              You can equip one wildcard per match. If you change your mind, you can un-equip it before kickoff to return it to your inventory!
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}

function StreakInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Prediction Streaks
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(200,200,200,0.05), rgba(150,150,150,0.05))', borderRadius: '12px', border: '1px solid rgba(200,200,200,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '24px' }}>🔥</span>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Rules of the Streak</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
              Maintain high accuracy to build your streak and earn wildcards!
            </p>
            <ul style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>How to Build:</strong> Predict with <strong>&ge; 30% accuracy</strong> to increase your streak by 1.</li>
              <li><strong>The Risk:</strong> If your accuracy is <strong>&lt; 30%</strong>, or if you <strong>skip a match</strong>, your streak completely resets to 0.</li>
              <li><strong>The Reward:</strong> For every multiple of 5 on your streak (5, 10, 15...), you earn a Halal Ball wildcard!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
