import { API_URL } from '../config'
import type { Difficulty } from './challenges'

export type TimedScoreBest = {
  timeSeconds: number
  completedAt: string
}

export type TimedScoreBestResponse = Record<Difficulty, TimedScoreBest | null>

export const PENDING_TIMED_SCORE_KEY = 'vim_royale_pending_timed_score'

type PendingTimedScore = {
  runToken: string
  guestSessionToken?: string
  createdAt: number
}

export async function startTimedRun(difficulty: Difficulty, guestSessionToken?: string): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (guestSessionToken) {
    headers['X-Guest-Session'] = guestSessionToken
  }

  const response = await fetch(`${API_URL}/timed-scores/run`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ difficulty }),
  })

  if (!response.ok) {
    throw new Error('failed to start timed run')
  }

  const payload = await response.json() as { runToken: string }
  if (!payload?.runToken) {
    throw new Error('missing run token')
  }
  return payload.runToken
}

export async function completeTimedRun(runToken: string, guestSessionToken?: string): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (guestSessionToken) {
    headers['X-Guest-Session'] = guestSessionToken
  }

  const response = await fetch(`${API_URL}/timed-scores/complete`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ runToken }),
  })

  if (!response.ok) {
    throw new Error('failed to complete timed run')
  }
}

export async function saveTimedScore(runToken: string, guestSessionToken?: string): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (guestSessionToken) {
    headers['X-Guest-Session'] = guestSessionToken
  }

  const response = await fetch(`${API_URL}/auth/timed-scores/save`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ runToken }),
  })

  if (!response.ok) {
    throw new Error('failed to save timed score')
  }
}

export async function getTimedScoreBests(): Promise<TimedScoreBestResponse> {
  const response = await fetch(`${API_URL}/auth/timed-scores/best`, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('failed to load timed score bests')
  }
  return response.json() as Promise<TimedScoreBestResponse>
}

export function setPendingTimedScore(score: PendingTimedScore) {
  sessionStorage.setItem(PENDING_TIMED_SCORE_KEY, JSON.stringify(score))
}

export function readPendingTimedScore(): PendingTimedScore | null {
  try {
    const raw = sessionStorage.getItem(PENDING_TIMED_SCORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingTimedScore
    if (!parsed?.runToken || !parsed?.createdAt) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingTimedScore() {
  sessionStorage.removeItem(PENDING_TIMED_SCORE_KEY)
}
