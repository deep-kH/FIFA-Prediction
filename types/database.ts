// BentoKick Database Types — mirrors Supabase schema

export interface Profile {
  id: string
  email: string
  display_name: string
  avatar_letter: string
  total_points: number
  is_admin: boolean
  current_streak?: number
  inventory_multiplier: number
  inventory_safety: number
  baseline_points?: number
  created_at: string
}

export interface Team {
  id: number
  name: string
  flag_emoji: string
  group_letter: string
}

export interface Player {
  id: number
  name: string
  team_id: number
  position: string
  teams?: Team
}

export interface Match {
  id: number
  home_team_id: number
  away_team_id: number
  kickoff_time: string
  stage: string // 'Group', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final'
  home_score: number | null
  away_score: number | null
  home_penalty_score?: number | null
  away_penalty_score?: number | null
  top_scorer_id: number | null
  is_completed: boolean
  home_team?: Team
  away_team?: Team
  top_scorer?: Player
}

export interface CustomPoll {
  id: number
  match_id: number
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D' | null
}

export interface Ballot {
  id: number
  user_id: string
  match_id: number
  predicted_home_score: number | null
  predicted_away_score: number | null
  predicted_home_penalty_score?: number | null
  predicted_away_penalty_score?: number | null
  predicted_top_scorer_id: number | null
  points_earned: number
  score_points_earned: number
  team_points_earned: number
  accuracy_rate: number
  accuracy_bonus_earned: number
  played_card: 'NONE' | 'MULTIPLIER' | 'SAFETY_NET'
  created_at: string
  profiles?: Profile
  predicted_top_scorer?: Player
}

export interface PollAnswer {
  id: number
  user_id: string
  poll_id: number
  selected_option: 'A' | 'B' | 'C' | 'D'
  points_earned: number
  custom_polls?: CustomPoll
}

export interface AllowedFriend {
  email: string
  added_at: string
}

// Composite type for dashboard display
export interface MatchWithDetails extends Match {
  home_team: Team
  away_team: Team
  top_scorer?: Player
  custom_polls?: CustomPoll[]
  user_ballot?: Ballot
  user_poll_answers?: PollAnswer[]
}

export interface LeaderboardEntry {
  rank: number
  id: string
  display_name: string
  avatar_letter: string
  total_points: number
  rank_change?: number // positive = up, negative = down
}
