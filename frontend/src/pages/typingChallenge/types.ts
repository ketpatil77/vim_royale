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
  opponentName: string
  opponentAvatar: string
  opponentRating: number
  role: 'A' | 'B'
  startedAt: number
  targetCode: string
  pollutedCode: string
}

export type BufferDeltaOp =
  | { type: 'insert'; pos: number; text: string }
  | { type: 'delete'; from: number; to: number }

export type BufferDelta = {
  ops: BufferDeltaOp[]
}

export type BufferUpdatePayload = {
  content?: string
  delta?: BufferDelta
  cursor?: number
}

export type GameOverPayload = {
  matchId: string
  winnerId: string
  loserId: string
  winnerName: string
  winnerAvatar: string
  winnerNewRating: number
  winnerDelta: number
  loserName: string
  loserAvatar: string
  loserNewRating: number
  loserDelta: number
  reason: string
  finishedAt: number
}

export type ErrorPayload = {
  code: string
  message: string
}

export type ViewState = 'idle' | 'matchmaking' | 'playing' | 'finished' | 'error' | 'countdown'

export type MatchState = {
  playerId: string
  opponentId: string
  opponentName: string
  opponentAvatar: string
  opponentRating: number
  matchId: string
}