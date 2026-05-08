export type MessageType =
  | 'HELLO'
  | 'HELLO_ACK'
  | 'QUEUE_JOIN'
  | 'GAME_START'
  | 'BUFFER_UPDATE'
  | 'PLAYER_FINISHED'
  | 'GAME_OVER'
  | 'ERROR'

export type Envelope = {
  type: MessageType
  matchId?: string
  playerId?: string
  seq?: number
  timestamp?: number
  payload?: unknown
}

export type HelloAckPayload = {
  playerId: string
}

export type GameStartPayload = {
  matchId: string
  opponentId: string
  role: 'A' | 'B'
  startedAt: number
  targetCode: string
  pollutedCode: string
}

export type BufferUpdatePayload = {
  content: string
  cursor?: number
}

export type GameOverPayload = {
  matchId: string
  winnerId: string
  loserId: string
  reason: string
  finishedAt: number
}

export type ErrorPayload = {
  code: string
  message: string
}

export type ViewState = 'idle' | 'matchmaking' | 'playing' | 'finished' | 'error'

export type MatchState = {
  playerId: string
  opponentId: string
  matchId: string
}