import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useAuth } from '../../contexts/AuthContext'
import { useCRT } from '../../contexts/CRTContext'
import type { TournamentLeaderboardEntry, TournamentMatch, TournamentParticipant, TournamentSummary } from '../../types/tournament'
import {
  getTournamentById,
  getTournamentBySlug,
  getTournamentLeaderboard,
  joinTournament,
  readTournamentSessionToken,
  regenerateInvite,
  seedTournament,
  setTournamentLock,
  subscribeTournamentEvents,
  startTournament,
  writeTournamentSessionToken,
} from '../../utils/tournamentApi'
import './Tournament.css'

type LobbyState = {
  tournament: TournamentSummary | null
  participant: TournamentParticipant | null
  participants: TournamentParticipant[]
  matches: TournamentMatch[]
  requiresJoin: boolean
}

type MatchCard = {
  id: number
  round: number
  slot: number
  status: 'pending' | 'playing' | 'completed'
  playerAId: number | null
  playerBId: number | null
  winnerId: number | null
}

const initialLobbyState: LobbyState = {
  tournament: null,
  participant: null,
  participants: [],
  matches: [],
  requiresJoin: false,
}

function getMatchId(match: TournamentMatch): number {
  const anyMatch = match as TournamentMatch & { id?: number }
  return anyMatch.id ?? anyMatch.ID ?? 0
}

function normalizeMatch(match: TournamentMatch): MatchCard {
  return {
    id: getMatchId(match),
    round: Number(match.round || 0),
    slot: Number(match.slot || 0),
    status: match.status,
    playerAId: match.playerAParticipantId ?? null,
    playerBId: match.playerBParticipantId ?? null,
    winnerId: match.winnerParticipantId ?? null,
  }
}

function seedSort(a: TournamentParticipant, b: TournamentParticipant): number {
  const seedA = a.seed ?? Number.MAX_SAFE_INTEGER
  const seedB = b.seed ?? Number.MAX_SAFE_INTEGER
  if (seedA !== seedB) return seedA - seedB
  return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
}

function compareLeaderboardRows(a: TournamentLeaderboardEntry, b: TournamentLeaderboardEntry): number {
  if (a.points !== b.points) return b.points - a.points
  if (a.wins !== b.wins) return b.wins - a.wins
  if (a.losses !== b.losses) return a.losses - b.losses
  const seedA = a.seed ?? Number.MAX_SAFE_INTEGER
  const seedB = b.seed ?? Number.MAX_SAFE_INTEGER
  if (seedA !== seedB) return seedA - seedB
  return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
}

export default function TournamentLobby() {
  const { slug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { crtEnabled, toggleCrt } = useCRT()

  const inviteFromLink = searchParams.get('invite') || ''
  const sessionFromLink = searchParams.get('sessionToken') || ''

  const [state, setState] = useState<LobbyState>(initialLobbyState)
  const [leaderboard, setLeaderboard] = useState<TournamentLeaderboardEntry[]>([])
  const [inviteLink, setInviteLink] = useState('')
  const [joinInviteToken, setJoinInviteToken] = useState(inviteFromLink)
  const [joinDisplayName, setJoinDisplayName] = useState(user?.displayName || '')
  const [seedOrder, setSeedOrder] = useState<number[]>([])
  const [draggingParticipantId, setDraggingParticipantId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copyInviteStatus, setCopyInviteStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const currentSessionToken = useMemo(() => {
    if (user) return ''
    if (sessionFromLink) return sessionFromLink
    if (!state.tournament) return ''
    return readTournamentSessionToken(state.tournament.id)
  }, [user, sessionFromLink, state.tournament])

  const hydrateInviteLink = useCallback((tournament: TournamentSummary, token: string) => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/t/${tournament.slug}?invite=${encodeURIComponent(token)}`
    setInviteLink(url)
  }, [])

  const setSeedOrderFromParticipants = useCallback((participants: TournamentParticipant[]) => {
    const ordered = [...participants].sort(seedSort)
    setSeedOrder(ordered.map((p) => p.id))
  }, [])

  const loadByTournamentId = useCallback(async (tournamentId: number, sessionToken: string) => {
    const detail = await getTournamentById(tournamentId, sessionToken || undefined)
    setState({
      tournament: detail.tournament,
      participant: detail.participant,
      participants: detail.participants,
      matches: detail.matches,
      requiresJoin: false,
    })
    setSeedOrderFromParticipants(detail.participants)

    if (inviteFromLink) {
      hydrateInviteLink(detail.tournament, inviteFromLink)
    }

    try {
      const board = await getTournamentLeaderboard(tournamentId, sessionToken || undefined)
      setLeaderboard(board)
    } catch {
      setLeaderboard([])
    }
  }, [hydrateInviteLink, inviteFromLink, setSeedOrderFromParticipants])

  const loadLobby = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setError('')

    try {
      const bySlug = await getTournamentBySlug(slug, sessionFromLink || undefined)
      if (sessionFromLink && bySlug.tournament && !user) {
        writeTournamentSessionToken(bySlug.tournament.id, sessionFromLink)

        const params = new URLSearchParams(searchParams)
        if (params.has('sessionToken')) {
          params.delete('sessionToken')
          const query = params.toString()
          navigate(`/t/${slug}${query ? `?${query}` : ''}`, { replace: true })
        }
      }

      if (bySlug.requiresJoin && bySlug.tournament) {
        const remembered = readTournamentSessionToken(bySlug.tournament.id)
        if (remembered) {
          try {
            await loadByTournamentId(bySlug.tournament.id, remembered)
            setLoading(false)
            return
          } catch {
            // fall through to join state
          }
        }
      }

      const participants = bySlug.participants || []
      setState({
        tournament: bySlug.tournament,
        participant: bySlug.participant || null,
        participants,
        matches: bySlug.matches || [],
        requiresJoin: bySlug.requiresJoin,
      })
      setSeedOrderFromParticipants(participants)

      if (!bySlug.requiresJoin && bySlug.tournament) {
        const token = sessionFromLink || readTournamentSessionToken(bySlug.tournament.id)
        const board = await getTournamentLeaderboard(bySlug.tournament.id, token || undefined)
        setLeaderboard(board)
      } else {
        setLeaderboard([])
      }

      if (bySlug.tournament && inviteFromLink) {
        hydrateInviteLink(bySlug.tournament, inviteFromLink)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }, [hydrateInviteLink, inviteFromLink, loadByTournamentId, navigate, searchParams, sessionFromLink, setSeedOrderFromParticipants, slug, user])

  useEffect(() => {
    setJoinInviteToken(inviteFromLink)
  }, [inviteFromLink])

  useEffect(() => {
    setJoinDisplayName(user?.displayName || '')
  }, [user?.displayName])

  useEffect(() => {
    loadLobby()
  }, [loadLobby])

  const tournamentId = state.tournament?.id ?? 0
  useEffect(() => {
    if (!tournamentId || state.requiresJoin) return

    let cancelled = false
    const syncLobby = async () => {
      if (cancelled || document.hidden) return
      try {
        const detail = await getTournamentById(tournamentId, currentSessionToken || undefined)
        if (cancelled) return
        setState((prev) => ({
          ...prev,
          tournament: detail.tournament,
          participant: detail.participant,
          participants: detail.participants,
          matches: detail.matches,
          requiresJoin: false,
        }))

        const board = await getTournamentLeaderboard(tournamentId, currentSessionToken || undefined)
        if (cancelled) return
        setLeaderboard(board)
      } catch {
        // keep existing UI on transient polling failures
      }
    }

    const unsubscribe = subscribeTournamentEvents(
      tournamentId,
      currentSessionToken || undefined,
      () => {
        void syncLobby()
      }
    )

    const interval = window.setInterval(syncLobby, 30000)
    const onFocus = () => {
      void syncLobby()
    }
    const onVisibilityChange = () => {
      if (!document.hidden) {
        void syncLobby()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      unsubscribe()
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [currentSessionToken, state.requiresJoin, tournamentId])

  const participantById = useMemo(() => {
    const map = new Map<number, TournamentParticipant>()
    for (const p of state.participants) {
      map.set(p.id, p)
    }
    return map
  }, [state.participants])

  const seedDraftParticipants = useMemo(() => {
    if (seedOrder.length === 0) {
      return [...state.participants].sort(seedSort)
    }

    const ordered: TournamentParticipant[] = []
    const seen = new Set<number>()

    for (const id of seedOrder) {
      const participant = participantById.get(id)
      if (participant) {
        ordered.push(participant)
        seen.add(id)
      }
    }

    for (const participant of state.participants) {
      if (!seen.has(participant.id)) {
        ordered.push(participant)
      }
    }

    return ordered
  }, [participantById, seedOrder, state.participants])

  const rounds = useMemo(() => {
    const cards = state.matches.map(normalizeMatch)
    const grouped = new Map<number, MatchCard[]>()

    for (const card of cards) {
      if (!grouped.has(card.round)) grouped.set(card.round, [])
      grouped.get(card.round)?.push(card)
    }

    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, matches]) => ({
        round,
        matches: [...matches].sort((a, b) => a.slot - b.slot),
      }))
  }, [state.matches])

  const computedLeaderboard = useMemo(() => {
    const rows = new Map<number, TournamentLeaderboardEntry>()
    for (const participant of state.participants) {
      rows.set(participant.id, {
        participantId: participant.id,
        displayName: participant.displayName,
        avatarUrl: participant.avatarUrl,
        seed: participant.seed ?? undefined,
        joinedAt: participant.joinedAt,
        wins: 0,
        losses: 0,
        points: 0,
      })
    }

    for (const rawMatch of state.matches) {
      const match = normalizeMatch(rawMatch)
      if (match.status !== 'completed' || !match.winnerId) continue

      const winner = rows.get(match.winnerId)
      if (winner) {
        winner.wins += 1
        winner.points += 3
      }

      if (match.playerAId && match.playerAId !== match.winnerId) {
        const loserA = rows.get(match.playerAId)
        if (loserA) loserA.losses += 1
      }
      if (match.playerBId && match.playerBId !== match.winnerId) {
        const loserB = rows.get(match.playerBId)
        if (loserB) loserB.losses += 1
      }
    }

    return [...rows.values()].sort(compareLeaderboardRows)
  }, [state.matches, state.participants])

  const participantStatus = useMemo(() => {
    const statusMap = new Map<number, string>()

    for (const participant of state.participants) {
      statusMap.set(participant.id, 'Waiting')
    }

    for (const rawMatch of state.matches) {
      const match = normalizeMatch(rawMatch)
      const ids = [match.playerAId, match.playerBId].filter((id): id is number => !!id)
      for (const id of ids) {
        if (match.status === 'playing') {
          statusMap.set(id, 'In Match')
        } else if (match.status === 'completed') {
          if (match.winnerId === id) {
            statusMap.set(id, 'Advanced')
          } else {
            statusMap.set(id, 'Eliminated')
          }
        }
      }
    }

    if (state.tournament?.status === 'finished') {
      let finalWinner: number | null = null
      for (const round of rounds) {
        for (const match of round.matches) {
          if (match.winnerId) finalWinner = match.winnerId
        }
      }
      if (finalWinner) {
        statusMap.set(finalWinner, 'Champion')
      }
    }

    return statusMap
  }, [rounds, state.matches, state.participants, state.tournament?.status])

  const liveMatchByParticipantId = useMemo(() => {
    const liveMap = new Map<number, string>()
    for (const rawMatch of state.matches) {
      const match = normalizeMatch(rawMatch)
      if (match.status !== 'playing') continue
      const liveMatchId = rawMatch.liveMatchId || ''
      if (!liveMatchId) continue
      if (match.playerAId) liveMap.set(match.playerAId, liveMatchId)
      if (match.playerBId) liveMap.set(match.playerBId, liveMatchId)
    }
    return liveMap
  }, [state.matches])

  const leaderboardRows = leaderboard.length > 0 ? leaderboard : computedLeaderboard
  const selfStatus = state.participant ? (participantStatus.get(state.participant.id) || 'Waiting') : 'Waiting'
  const selfParticipantId = state.participant?.id ?? null
  const canEnterMatchmaking =
    !!state.tournament &&
    state.tournament.status === 'active' &&
    (selfStatus === 'Waiting' || selfStatus === 'Advanced')

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.tournament) return
    if (!joinInviteToken.trim()) {
      setError('Invite token is required to join')
      return
    }

    setBusy(true)
    setError('')
    try {
      const response = await joinTournament(state.tournament.id, {
        inviteToken: joinInviteToken.trim(),
        displayName: joinDisplayName.trim() || undefined,
      }, currentSessionToken || undefined)

      const token = response.guestSessionToken || ''
      if (token) {
        writeTournamentSessionToken(state.tournament.id, token)
      }

      await loadByTournamentId(state.tournament.id, token)
      hydrateInviteLink(state.tournament, joinInviteToken.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join tournament')
    } finally {
      setBusy(false)
    }
  }

  const handleLockToggle = async () => {
    if (!state.tournament) return
    setBusy(true)
    setError('')
    try {
      await setTournamentLock(state.tournament.id, !state.tournament.isLocked)
      await loadByTournamentId(state.tournament.id, currentSessionToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock')
    } finally {
      setBusy(false)
    }
  }

  const handleSeed = async () => {
    if (!state.tournament) return
    setBusy(true)
    setError('')
    try {
      await seedTournament(state.tournament.id, seedDraftParticipants.map((p) => p.id))
      await loadByTournamentId(state.tournament.id, currentSessionToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed tournament')
    } finally {
      setBusy(false)
    }
  }

  const moveSeedEntry = useCallback((participantId: number, direction: -1 | 1) => {
    setSeedOrder((prev) => {
      const current = prev.length ? [...prev] : seedDraftParticipants.map((p) => p.id)
      const index = current.indexOf(participantId)
      if (index === -1) return current
      const next = index + direction
      if (next < 0 || next >= current.length) return current
      const temp = current[index]
      current[index] = current[next]
      current[next] = temp
      return current
    })
  }, [seedDraftParticipants])

  const reorderSeedDraft = useCallback((fromId: number, toId: number) => {
    if (fromId === toId) return
    setSeedOrder((prev) => {
      const current = prev.length ? [...prev] : seedDraftParticipants.map((p) => p.id)
      const fromIndex = current.indexOf(fromId)
      const toIndex = current.indexOf(toId)
      if (fromIndex === -1 || toIndex === -1) return current
      const [moved] = current.splice(fromIndex, 1)
      current.splice(toIndex, 0, moved)
      return current
    })
  }, [seedDraftParticipants])

  const handleStart = async () => {
    if (!state.tournament) return
    setBusy(true)
    setError('')
    try {
      await startTournament(state.tournament.id)
      await loadByTournamentId(state.tournament.id, currentSessionToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tournament')
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerateInvite = async () => {
    if (!state.tournament) return
    setBusy(true)
    setError('')
    try {
      const data = await regenerateInvite(state.tournament.id)
      setInviteLink(data.inviteLink)
      setJoinInviteToken(data.inviteToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate invite')
    } finally {
      setBusy(false)
    }
  }

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink)
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea')
        textarea.value = inviteLink
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (!copied) {
          throw new Error('copy command failed')
        }
      } else {
        throw new Error('clipboard unavailable')
      }

      setCopyInviteStatus('copied')
      window.setTimeout(() => setCopyInviteStatus('idle'), 1800)
    } catch {
      setCopyInviteStatus('error')
      window.setTimeout(() => setCopyInviteStatus('idle'), 2200)
    }
  }

  const joinMatchmaking = () => {
    if (!state.tournament) return
    const params = new URLSearchParams()
    params.set('tournamentId', String(state.tournament.id))
    params.set('slug', state.tournament.slug)
    navigate(`/match/tournament?${params.toString()}`)
  }

  if (loading) {
    return (
      <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
        <div className="tournament-shell">
          <div className="tournament-card">
            <p className="tournament-note">Loading tournament...</p>
          </div>
        </div>
      </TerminalLayout>
    )
  }

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="tournament-shell">
        <div className="tournament-card">
          <h1 className="tournament-title">&gt;&gt; {state.tournament?.name || 'TOURNAMENT'}</h1>
          {error && <p className="tournament-error">{error}</p>}

          {state.requiresJoin ? (
            <form className="tournament-form" onSubmit={handleJoin}>
              <p className="tournament-note">Join this private room to access matches and leaderboard.</p>
              <label className="tournament-label" htmlFor="inviteToken">Invite Token</label>
              <input
                id="inviteToken"
                className="tournament-input"
                value={joinInviteToken}
                onChange={(e) => setJoinInviteToken(e.target.value)}
                placeholder="Paste invite token"
                required
              />
              {!user && (
                <>
                  <label className="tournament-label" htmlFor="displayName">Display Name</label>
                  <input
                    id="displayName"
                    className="tournament-input"
                    value={joinDisplayName}
                    onChange={(e) => setJoinDisplayName(e.target.value)}
                    placeholder="Guest name"
                    required
                  />
                </>
              )}
              <div className="tournament-row">
                <button className="tournament-btn" type="submit" disabled={busy}>
                  {busy ? 'JOINING...' : 'JOIN TOURNAMENT'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="tournament-toolbar">
                <div className="tournament-toolbar-group">
                  {canEnterMatchmaking ? (
                    <button className="tournament-btn tournament-btn--primary" onClick={joinMatchmaking}>
                      ENTER MATCHMAKING
                    </button>
                  ) : (
                    <button className="tournament-btn tournament-btn--ghost" type="button" disabled>
                      {selfStatus === 'Eliminated'
                        ? 'ELIMINATED'
                        : selfStatus === 'Champion'
                          ? 'TOURNAMENT WON'
                          : selfStatus === 'In Match'
                            ? 'MATCH IN PROGRESS'
                            : state.tournament?.status === 'lobby'
                              ? 'WAITING FOR START'
                              : 'NOT ELIGIBLE'}
                    </button>
                  )}
                  <button className="tournament-btn tournament-btn--ghost" onClick={loadLobby}>
                    REFRESH
                  </button>
                </div>

                {state.participant?.isHost && (
                  <div className="tournament-toolbar-group tournament-toolbar-group--host">
                    <button className="tournament-btn tournament-btn--small tournament-btn--accent" onClick={handleStart} disabled={busy}>
                      START
                    </button>
                    <button className="tournament-btn tournament-btn--small" onClick={handleSeed} disabled={busy}>
                      APPLY SEEDS
                    </button>
                    <button className="tournament-btn tournament-btn--small tournament-btn--ghost" onClick={handleLockToggle} disabled={busy}>
                      {state.tournament?.isLocked ? 'UNLOCK' : 'LOCK'}
                    </button>
                    <button className="tournament-btn tournament-btn--small tournament-btn--ghost" onClick={handleRegenerateInvite} disabled={busy}>
                      REGENERATE LINK
                    </button>
                  </div>
                )}
              </div>

              {state.participant?.isHost && (
                <div className="tournament-host-note">
                  Host controls: start the bracket, update seeds, reopen/lock registration, or rotate the invite.
                </div>
              )}

              {inviteLink && (
                <div className="tournament-share">
                  <div className="tournament-share-head">
                    <p className="tournament-label">Invite Link</p>
                    <button
                      type="button"
                      className="tournament-btn tournament-btn--small tournament-btn--ghost"
                      onClick={handleCopyInviteLink}
                    >
                      {copyInviteStatus === 'copied' ? 'COPIED' : 'COPY LINK'}
                    </button>
                  </div>
                  <code className="tournament-code">{inviteLink}</code>
                  {copyInviteStatus === 'error' && (
                    <p className="tournament-copy-feedback tournament-copy-feedback--error">
                      Could not copy automatically. Please copy the link manually.
                    </p>
                  )}
                </div>
              )}

              {state.participant?.isHost && state.tournament?.status === 'lobby' && (
                <section className="tournament-section">
                  <h2 className="tournament-subtitle">Seeding Board</h2>
                  <p className="tournament-note">Drag players to reorder seeds before starting the tournament.</p>
                  <div className="seed-list" role="list">
                    {seedDraftParticipants.map((p, idx) => (
                      <div
                        key={p.id}
                        role="listitem"
                        className={`seed-item ${draggingParticipantId === p.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => setDraggingParticipantId(p.id)}
                        onDragEnd={() => setDraggingParticipantId(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggingParticipantId) reorderSeedDraft(draggingParticipantId, p.id)
                          setDraggingParticipantId(null)
                        }}
                      >
                        <div className="seed-meta">
                          <span className="seed-rank">#{idx + 1}</span>
                          <span className="seed-name">{p.displayName}</span>
                        </div>
                        <div className="seed-controls">
                          <button className="tournament-btn tournament-btn--small" type="button" onClick={() => moveSeedEntry(p.id, -1)}>
                            ↑
                          </button>
                          <button className="tournament-btn tournament-btn--small" type="button" onClick={() => moveSeedEntry(p.id, 1)}>
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="tournament-section">
                <h2 className="tournament-subtitle">Bracket View</h2>
                {rounds.length === 0 ? (
                  <p className="tournament-note">No matches yet. Seed and start tournament.</p>
                ) : (
                  <div className="bracket-grid bracket-grid-pro">
                    {rounds.map((round, roundIndex) => (
                      <div
                        key={round.round}
                        className={`bracket-round ${roundIndex === rounds.length - 1 ? 'is-last-round' : ''}`}
                      >
                        <h3 className="bracket-round-title">Round {round.round}</h3>
                        <div className="bracket-round-matches">
                          {round.matches.map((match) => {
                            const a = match.playerAId ? participantById.get(match.playerAId) : null
                            const b = match.playerBId ? participantById.get(match.playerBId) : null
                            const winnerId = match.winnerId
                            return (
                              <div key={match.id || `${match.round}-${match.slot}`} className={`bracket-match-card bracket-${match.status}`}>
                                <div className="bracket-match-head">
                                  <span className="bracket-match-label">Match {match.slot}</span>
                                  <span className={`bracket-match-state state-${match.status}`}>{match.status}</span>
                                </div>
                                <div className="bracket-match-players">
                                  <div className={`bracket-player-row ${winnerId && match.playerAId === winnerId ? 'winner' : ''} ${!a ? 'placeholder' : ''}`}>
                                    <span className="bracket-player-name">{a?.displayName || 'TBD'}</span>
                                    <span className="bracket-player-seed">{a?.seed ? `S${a.seed}` : '--'}</span>
                                  </div>
                                  <div className={`bracket-player-row ${winnerId && match.playerBId === winnerId ? 'winner' : ''} ${!b ? 'placeholder' : ''}`}>
                                    <span className="bracket-player-name">{b?.displayName || 'TBD'}</span>
                                    <span className="bracket-player-seed">{b?.seed ? `S${b.seed}` : '--'}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="tournament-section">
                <h2 className="tournament-subtitle">Private Leaderboard</h2>
                <table className="tournament-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Status</th>
                      <th>W</th>
                      <th>L</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardRows.length === 0 && (
                      <tr>
                        <td colSpan={6}>No leaderboard entries yet.</td>
                      </tr>
                    )}
                    {leaderboardRows.map((entry, idx) => (
                      <tr
                        key={entry.participantId}
                        className={entry.participantId === selfParticipantId ? 'tournament-row-self' : ''}
                      >
                        <td>{idx + 1}</td>
                        <td>
                          <span className="tournament-leaderboard-player">
                            <span>{entry.displayName}</span>
                            {entry.participantId === selfParticipantId && (
                              <span className="tournament-you-tag">YOU</span>
                            )}
                            {liveMatchByParticipantId.get(entry.participantId) && (
                              <button
                                type="button"
                                className="tournament-live-btn"
                                title="Watch live match"
                                aria-label={`Watch ${entry.displayName} live`}
                                onClick={() => {
                                  const matchId = liveMatchByParticipantId.get(entry.participantId)
                                  if (!matchId) return
                                  navigate(`/match/${matchId}/live`)
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path d="M1.5 12s3.8-7 10.5-7 10.5 7 10.5 7-3.8 7-10.5 7S1.5 12 1.5 12z" stroke="currentColor" strokeWidth="1.6"/>
                                  <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6"/>
                                </svg>
                              </button>
                            )}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill status-${(participantStatus.get(entry.participantId) || 'waiting').toLowerCase().replace(/\s+/g, '-')}`}>
                            {participantStatus.get(entry.participantId) || 'Waiting'}
                          </span>
                        </td>
                        <td>{entry.wins}</td>
                        <td>{entry.losses}</td>
                        <td>{entry.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </div>
      </div>
    </TerminalLayout>
  )
}
