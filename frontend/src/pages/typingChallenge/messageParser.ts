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
  if (payload.role !== 'A' && payload.role !== 'B') return null
  if (typeof payload.startedAt !== 'number') return null
  if (typeof payload.targetCode !== 'string') return null
  if (typeof payload.pollutedCode !== 'string') return null

  return {
    matchId: payload.matchId,
    opponentId: payload.opponentId,
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
  if (typeof payload.reason !== 'string') return null
  if (typeof payload.finishedAt !== 'number') return null

  return {
    matchId: payload.matchId,
    winnerId: payload.winnerId,
    loserId: payload.loserId,
    reason: payload.reason,
    finishedAt: payload.finishedAt,
  }
}

export function parseErrorPayload(payload: unknown): ErrorPayload | null {
  if (!isRecord(payload)) return null
  if (typeof payload.code !== 'string' || typeof payload.message !== 'string') return null
  return { code: payload.code, message: payload.message }
}