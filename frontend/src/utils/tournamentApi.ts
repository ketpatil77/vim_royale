import { API_URL } from '../config'
import type {
  CreateTournamentRequest,
  CreateTournamentResponse,
  JoinTournamentRequest,
  JoinTournamentResponse,
  TournamentBySlugResponse,
  TournamentDetailsResponse,
  TournamentLeaderboardEntry,
  TournamentParticipant,
} from '../types/tournament'

function buildSessionHeaders(sessionToken?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (sessionToken) {
    headers['X-Tournament-Session'] = sessionToken
  }
  return headers
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json() as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // ignore json parsing errors on failure responses
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export async function createTournament(payload: CreateTournamentRequest): Promise<CreateTournamentResponse> {
  const res = await fetch(`${API_URL}/tournaments`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrow<CreateTournamentResponse>(res)
}

export async function getTournamentBySlug(slug: string, sessionToken?: string): Promise<TournamentBySlugResponse> {
  const url = `${API_URL}/tournaments/slug/${encodeURIComponent(slug)}`
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: buildSessionHeaders(sessionToken),
  })
  return parseJsonOrThrow<TournamentBySlugResponse>(res)
}

export async function joinTournament(
  tournamentId: number,
  payload: JoinTournamentRequest,
  sessionToken?: string
): Promise<JoinTournamentResponse> {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}/join`, {
    method: 'POST',
    credentials: 'include',
    headers: buildSessionHeaders(sessionToken),
    body: JSON.stringify(payload),
  })
  return parseJsonOrThrow<JoinTournamentResponse>(res)
}

export async function getTournamentById(tournamentId: number, sessionToken?: string): Promise<TournamentDetailsResponse> {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}`, {
    method: 'GET',
    credentials: 'include',
    headers: buildSessionHeaders(sessionToken),
  })
  return parseJsonOrThrow<TournamentDetailsResponse>(res)
}

export async function setTournamentLock(tournamentId: number, locked: boolean): Promise<void> {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}/lock`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locked }),
  })
  await parseJsonOrThrow<{ locked: boolean }>(res)
}

export async function seedTournament(tournamentId: number, participantIds: number[]): Promise<TournamentParticipant[]> {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}/seed`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ participantIds }),
  })
  const data = await parseJsonOrThrow<{ participants: TournamentParticipant[] }>(res)
  return data.participants
}

export async function startTournament(tournamentId: number): Promise<void> {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}/start`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  await parseJsonOrThrow<{ ok?: boolean }>(res)
}

export async function regenerateInvite(tournamentId: number): Promise<{ inviteToken: string; inviteLink: string }> {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}/invite/regenerate`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  return parseJsonOrThrow<{ inviteToken: string; inviteLink: string }>(res)
}

export async function getTournamentLeaderboard(tournamentId: number, sessionToken?: string): Promise<TournamentLeaderboardEntry[]> {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}/leaderboard`, {
    method: 'GET',
    credentials: 'include',
    headers: buildSessionHeaders(sessionToken),
  })
  const data = await parseJsonOrThrow<{ items: TournamentLeaderboardEntry[] }>(res)
  return data.items
}

export function getTournamentSessionStorageKey(tournamentId: number): string {
  return `vimRoyaleTournamentSession:${tournamentId}`
}

export function readTournamentSessionToken(tournamentId: number): string {
  return localStorage.getItem(getTournamentSessionStorageKey(tournamentId)) || ''
}

export function writeTournamentSessionToken(tournamentId: number, token: string): void {
  if (!token) return
  localStorage.setItem(getTournamentSessionStorageKey(tournamentId), token)
}

export type TournamentStreamEvent = {
  type: string
  tournamentId: number
  ts: number
}

export function subscribeTournamentEvents(
  tournamentId: number,
  sessionToken: string | undefined,
  onEvent: (event: TournamentStreamEvent) => void
): () => void {
  let cancelled = false
  let currentController: AbortController | null = null

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const handleBlock = (block: string) => {
    const lines = block.split('\n')
    let eventName = ''
    const dataLines: string[] = []
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      }
    }
    if (eventName !== 'tournament_update' || dataLines.length === 0) return
    const rawData = dataLines.join('\n')
    try {
      const parsed = JSON.parse(rawData) as TournamentStreamEvent
      if (parsed && parsed.tournamentId === tournamentId) {
        onEvent(parsed)
      }
    } catch {
      // ignore malformed event payloads
    }
  }

  const connect = async () => {
    while (!cancelled) {
      currentController = new AbortController()
      try {
        const res = await fetch(`${API_URL}/tournaments/${tournamentId}/events`, {
          method: 'GET',
          credentials: 'include',
          headers: buildSessionHeaders(sessionToken),
          signal: currentController.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error(`stream_failed_${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const blocks = buffer.split('\n\n')
          buffer = blocks.pop() || ''
          for (const block of blocks) {
            handleBlock(block)
          }
        }
      } catch {
        if (cancelled) return
      } finally {
        currentController = null
      }

      if (!cancelled) {
        await sleep(1200)
      }
    }
  }

  void connect()

  return () => {
    cancelled = true
    if (currentController) {
      currentController.abort()
    }
  }
}
