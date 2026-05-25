import type { BufferDelta } from '../typingChallenge/types'

export type SpectatorSnapshot = {
  matchId: string
  startedAt: number
  targetCode: string
  pollutedCode: string
  playerA: {
    playerId: string
    displayName: string
    avatarUrl: string
  }
  playerB: {
    playerId: string
    displayName: string
    avatarUrl: string
  }
  playerABuffer: string
  playerBBuffer: string
}

export type SpectatorDelta = {
  playerId: string
  seq: number
  timestamp: number
  delta?: BufferDelta
  content?: string
}

export type SpectatorStatus = {
  state: 'playing' | 'finished'
  reason?: string
  matchId?: string
}
