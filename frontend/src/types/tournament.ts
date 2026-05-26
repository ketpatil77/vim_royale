export type TournamentStatus = 'lobby' | 'active' | 'finished'
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'group_knockout'

export type TournamentSettings = {
  grandFinalReset?: boolean | null
  groupSize?: number | null
  advancePerGroup?: number | null
}

export type TournamentSummary = {
  id: number
  name: string
  slug: string
  hostUserId: number
  status: TournamentStatus
  format: TournamentFormat
  settings?: TournamentSettings
  maxPlayers: number
  isLocked: boolean
  startedAt?: string | null
  endedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type TournamentParticipant = {
  id: number
  tournamentId: number
  userId?: number | null
  displayName: string
  avatarUrl: string
  seed?: number | null
  joinedAt: string
  eliminatedAt?: string | null
  isHost: boolean
}

export type TournamentMatch = {
  ID: number
  tournamentId: number
  round: number
  slot: number
  stageType?: 'knockout' | 'group' | 'grand_final'
  bracketType?: 'main' | 'winners' | 'losers'
  groupNumber?: number | null
  stageRound?: number | null
  playerAParticipantId?: number | null
  playerBParticipantId?: number | null
  winnerParticipantId?: number | null
  status: 'pending' | 'playing' | 'completed'
  liveMatchId?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}

export type TournamentLeaderboardEntry = {
  participantId: number
  displayName: string
  avatarUrl: string
  seed?: number
  joinedAt: string
  wins: number
  losses: number
  points: number
}

export type CreateTournamentRequest = {
  name: string
  maxPlayers: number
  format?: TournamentFormat
  settings?: TournamentSettings
}

export type CreateTournamentResponse = {
  tournament: TournamentSummary
  inviteToken: string
  inviteLink: string
}

export type JoinTournamentRequest = {
  inviteToken: string
  displayName?: string
  avatarUrl?: string
}

export type JoinTournamentResponse = {
  tournament: TournamentSummary
  participant: TournamentParticipant
  guestSessionToken?: string
  tournamentAccessBy: string
}

export type TournamentBySlugResponse = {
  tournament: TournamentSummary
  participant?: TournamentParticipant
  participants?: TournamentParticipant[]
  matches?: TournamentMatch[]
  requiresJoin: boolean
  inviteTokenParam?: string
}

export type TournamentDetailsResponse = {
  tournament: TournamentSummary
  participant: TournamentParticipant
  participants: TournamentParticipant[]
  matches: TournamentMatch[]
}
