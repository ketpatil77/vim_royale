import type {
  HelloAckPayload,
  GameStartPayload,
  BufferUpdatePayload,
  GameOverPayload,
  ErrorPayload,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseHelloAckPayload(payload: unknown): HelloAckPayload | null {
  if (!isRecord(payload) || typeof payload.playerId !== 'string') return null
  return { playerId: payload.playerId }
}

export function parseGameStartPayload(payload: unknown): GameStartPayload | null {
  if (!isRecord(payload)) return null
  if (typeof payload.matchId !== 'string') return null
  if (typeof payload.opponentId !== 'string') return null
  if (typeof payload.opponentName !== 'string') return null
  if (typeof payload.opponentAvatar !== 'string') return null
  if (typeof payload.opponentRating !== 'number') return null
  if (payload.role !== 'A' && payload.role !== 'B') return null
  if (typeof payload.startedAt !== 'number') return null
  if (typeof payload.targetCode !== 'string') return null
  if (typeof payload.pollutedCode !== 'string') return null

  return {
    matchId: payload.matchId,
    opponentId: payload.opponentId,
    opponentName: payload.opponentName,
    opponentAvatar: payload.opponentAvatar,
    opponentRating: payload.opponentRating,
    role: payload.role,
    startedAt: payload.startedAt,
    targetCode: payload.targetCode,
    pollutedCode: payload.pollutedCode,
  }
}

export function parseBufferUpdatePayload(payload: unknown): BufferUpdatePayload | null {
  if (!isRecord(payload) || typeof payload.content !== 'string') return null
  if (typeof payload.cursor !== 'undefined' && typeof payload.cursor !== 'number') return null

  return {
    content: payload.content,
    cursor: typeof payload.cursor === 'number' ? payload.cursor : undefined,
  }
}

export function parseGameOverPayload(payload: unknown): GameOverPayload | null {
  if (!isRecord(payload)) return null
  if (typeof payload.matchId !== 'string') return null
  if (typeof payload.winnerId !== 'string') return null
  if (typeof payload.loserId !== 'string') return null
  if (typeof payload.winnerName !== 'string') return null
  if (typeof payload.winnerAvatar !== 'string') return null
  if (typeof payload.winnerNewRating !== 'number') return null
  if (typeof payload.winnerDelta !== 'number') return null
  if (typeof payload.loserName !== 'string') return null
  if (typeof payload.loserAvatar !== 'string') return null
  if (typeof payload.loserNewRating !== 'number') return null
  if (typeof payload.loserDelta !== 'number') return null
  if (typeof payload.reason !== 'string') return null
  if (typeof payload.finishedAt !== 'number') return null

  return {
    matchId: payload.matchId,
    winnerId: payload.winnerId,
    loserId: payload.loserId,
    winnerName: payload.winnerName,
    winnerAvatar: payload.winnerAvatar,
    winnerNewRating: payload.winnerNewRating,
    winnerDelta: payload.winnerDelta,
    loserName: payload.loserName,
    loserAvatar: payload.loserAvatar,
    loserNewRating: payload.loserNewRating,
    loserDelta: payload.loserDelta,
    reason: payload.reason,
    finishedAt: payload.finishedAt,
  }
}

export function parseErrorPayload(payload: unknown): ErrorPayload | null {
  if (!isRecord(payload)) return null
  if (typeof payload.code !== 'string' || typeof payload.message !== 'string') return null
  return { code: payload.code, message: payload.message }
}