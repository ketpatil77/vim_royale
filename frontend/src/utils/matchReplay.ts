import { API_URL } from '../config'
import type { KeystrokeEntry } from '../pages/typingChallenge/types'

export interface ReplayPlayerData {
  playerId: string
  username: string
  displayName: string
  avatarUrl: string
  sent: unknown
  received: unknown
}

export interface MatchReplayResponse {
  matchId: string
  winnerId: number
  finishedAt: number
  targetCode?: string
  pollutedCode?: string
  playerA: ReplayPlayerData
  playerB: ReplayPlayerData
}

export async function fetchMatchReplay(matchId: string): Promise<MatchReplayResponse> {
  const response = await fetch(`${API_URL}/matches/${matchId}/replay`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch replay: ${response.statusText}`)
  }

  return response.json()
}

export function parseKeystrokes(input: unknown): KeystrokeEntry[] {
  try {
    if (Array.isArray(input)) {
      return input as KeystrokeEntry[]
    }

    if (typeof input === 'string') {
      const parsed = JSON.parse(input)
      if (Array.isArray(parsed)) {
        return parsed as KeystrokeEntry[]
      }
      return []
    }

    return []
  } catch {
    return []
  }
}

export type CMOp =
  | { retain: number }
  | { insert: string }
  | { delete: number }

type LegacyDeltaOp = { type: string; pos?: number; text?: string; from?: number; to?: number }
type CMOpLike = { retain?: number; insert?: string; delete?: number }

export function convertOps(ops: (LegacyDeltaOp | CMOpLike)[]): CMOp[] {
  const result: CMOp[] = []

  for (const op of ops) {
    if ('retain' in op && typeof op.retain === 'number') {
      result.push({ retain: op.retain })
      continue
    }

    if ('insert' in op && typeof op.insert === 'string' && !('type' in op)) {
      result.push({ insert: op.insert })
      continue
    }

    if ('delete' in op && typeof op.delete === 'number' && !('type' in op)) {
      result.push({ delete: op.delete })
      continue
    }

    if ('type' in op && op.type === 'insert' && op.pos !== undefined && op.text !== undefined) {
      if (op.pos > 0) {
        result.push({ retain: op.pos })
      }
      result.push({ insert: op.text })
    } else if ('type' in op && op.type === 'delete' && op.from !== undefined && op.to !== undefined) {
      if (op.from > 0) {
        result.push({ retain: op.from })
      }
      result.push({ delete: op.to - op.from })
    }
  }

  return result
}

export interface PlayerData {
  playerId: string
  username: string
  displayName: string
  avatarUrl: string
  keystrokes: KeystrokeEntry[]
}

export function transformReplayData(response: MatchReplayResponse): { p0: PlayerData; p1: PlayerData } {
  const playerASent = parseKeystrokes(response.playerA.sent)
  const playerAReceived = parseKeystrokes(response.playerA.received)
  const playerBSent = parseKeystrokes(response.playerB.sent)
  const playerBReceived = parseKeystrokes(response.playerB.received)

  const playerAKeystrokes = playerASent.length > 0 ? playerASent : playerBReceived
  const playerBKeystrokes = playerBSent.length > 0 ? playerBSent : playerAReceived

  return {
    p0: {
      playerId: response.playerA.playerId,
      username: response.playerA.username,
      displayName: response.playerA.displayName || response.playerA.username,
      avatarUrl: response.playerA.avatarUrl,
      keystrokes: playerAKeystrokes,
    },
    p1: {
      playerId: response.playerB.playerId,
      username: response.playerB.username,
      displayName: response.playerB.displayName || response.playerB.username,
      avatarUrl: response.playerB.avatarUrl,
      keystrokes: playerBKeystrokes,
    },
  }
}
