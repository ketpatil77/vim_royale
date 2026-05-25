export type MessageType =
  | 'HELLO'
  | 'HELLO_ACK'
  | 'QUEUE_JOIN'
  | 'GAME_START'
  | 'BOT_GAME_START'
  | 'BUFFER_UPDATE'
  | 'PLAYER_FINISHED'
  | 'GAME_OVER'
  | 'SPECTATOR_COUNT'
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
  roundDurationSec?: number
  role: 'A' | 'B'
  startedAt: number
  targetCode: string
  pollutedCode: string
}

export type BotGameStartPayload = {
  matchId: string
  botId: string
  botName: string
  botAvatar: string
  botRating: number
  roundDurationSec?: number
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
  timestamp?: number
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
  resultType?: 'decisive' | 'draw'
  reason: string
  finishedAt: number
}

export type SpectatorCountPayload = {
  count: number
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
  opponentIsBot: boolean
  matchId: string
  roundDurationSec: number
}

export type KeystrokeEntry = {
  ops: BufferDeltaOp[]
  timestamp: number
}

export type KeystrokesData = {
  playerA: KeystrokeEntry[]
  playerB: KeystrokeEntry[]
}

export type PlayerFinishedPayload = {
  finalHash?: string
  wpm?: number
  accuracy?: number
  keystrokes?: KeystrokesData
}
