import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorView } from '@codemirror/view'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { EditorPanel } from '../../components/EditorPanel/EditorPanel'
import { useCRT } from '../../contexts/CRTContext'
import { API_URL } from '../../config'
import { createEditorState } from '../typingChallenge/editorState'
import type { BufferDelta } from '../typingChallenge/types'
import type { SpectatorDelta, SpectatorSnapshot, SpectatorStatus } from './types'
import '../Play/MatchPage.css'
import './LiveSpectate.css'

const ROUND_DURATION_SEC = 180

type DeleteRange = {
  from: number
  to: number
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function applyBufferDelta(base: string, delta: BufferDelta): string {
  if (!delta.ops?.length) return base

  const insertions = new Map<number, string[]>()
  const deletes: DeleteRange[] = []

  for (const op of delta.ops) {
    if (op.type === 'insert') {
      const pos = clamp(op.pos, 0, base.length)
      const current = insertions.get(pos) || []
      current.push(op.text)
      insertions.set(pos, current)
      continue
    }

    if (op.type === 'delete') {
      const from = clamp(op.from, 0, base.length)
      const to = clamp(op.to, 0, base.length)
      if (to <= from) continue
      deletes.push({ from, to })
    }
  }

  deletes.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from))

  const mergedDeletes: DeleteRange[] = []
  for (const range of deletes) {
    const last = mergedDeletes[mergedDeletes.length - 1]
    if (!last) {
      mergedDeletes.push(range)
      continue
    }

    if (range.from <= last.to) {
      if (range.to > last.to) {
        last.to = range.to
      }
      continue
    }

    mergedDeletes.push(range)
  }

  let result = ''
  let deleteIndex = 0

  for (let idx = 0; idx <= base.length; idx += 1) {
    const pendingInsertions = insertions.get(idx)
    if (pendingInsertions) {
      result += pendingInsertions.join('')
    }

    if (idx === base.length) {
      break
    }

    while (deleteIndex < mergedDeletes.length && idx >= mergedDeletes[deleteIndex].to) {
      deleteIndex += 1
    }

    const activeDelete = mergedDeletes[deleteIndex]
    if (activeDelete && idx >= activeDelete.from && idx < activeDelete.to) {
      continue
    }

    result += base[idx]
  }

  return result
}

function replaceEditorContent(view: EditorView | null, nextContent: string) {
  if (!view) return

  const current = view.state.doc.toString()
  if (current === nextContent) return

  view.dispatch({
    changes: {
      from: 0,
      to: current.length,
      insert: nextContent,
    },
  })
}

function normalizeLines(value: string) {
  return value.replace(/\r\n/g, '\n').split('\n')
}

function findChangedLineIndexes(targetCode: string, currentCode: string): number[] {
  const targetLines = normalizeLines(targetCode)
  const currentLines = normalizeLines(currentCode)
  const max = Math.max(targetLines.length, currentLines.length)
  const changed: number[] = []

  for (let i = 0; i < max; i += 1) {
    if ((targetLines[i] || '') !== (currentLines[i] || '')) {
      changed.push(i)
    }
  }

  return changed
}

function formatRoundClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export default function LiveSpectate() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()

  const leftMountRef = useRef<HTMLDivElement>(null)
  const rightMountRef = useRef<HTMLDivElement>(null)
  const leftViewRef = useRef<EditorView | null>(null)
  const rightViewRef = useRef<EditorView | null>(null)
  const playerABufferRef = useRef('')
  const playerBBufferRef = useRef('')
  const snapshotRef = useRef<SpectatorSnapshot | null>(null)

  const [snapshot, setSnapshot] = useState<SpectatorSnapshot | null>(null)
  const [playerABuffer, setPlayerABuffer] = useState('')
  const [playerBBuffer, setPlayerBBuffer] = useState('')
  const [status, setStatus] = useState<SpectatorStatus>({ state: 'playing' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roundSecondsLeft, setRoundSecondsLeft] = useState(ROUND_DURATION_SEC)

  useEffect(() => {
    if (!matchId) {
      setLoading(false)
      setError('Missing match id')
      return
    }

    const streamUrl = `${API_URL}/matches/${encodeURIComponent(matchId)}/spectate`
    const source = new EventSource(streamUrl, { withCredentials: true })

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as SpectatorSnapshot
        setSnapshot(payload)
        snapshotRef.current = payload
        setStatus({ state: 'playing' })
        setError(null)
        setLoading(false)
        playerABufferRef.current = payload.playerABuffer || payload.pollutedCode || ''
        playerBBufferRef.current = payload.playerBBuffer || payload.pollutedCode || ''
        setPlayerABuffer(playerABufferRef.current)
        setPlayerBBuffer(playerBBufferRef.current)
      } catch {
        setError('Failed to parse spectator snapshot')
        setLoading(false)
      }
    }

    const handleDelta = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as SpectatorDelta
        const currentSnapshot = snapshotRef.current
        if (!currentSnapshot) return

        const applyPayload = (buffer: string, delta?: BufferDelta, content?: string) => {
          if (typeof content === 'string') return content
          if (delta) return applyBufferDelta(buffer, delta)
          return buffer
        }

        if (payload.playerId === currentSnapshot.playerA.playerId) {
          const next = applyPayload(playerABufferRef.current, payload.delta, payload.content)
          playerABufferRef.current = next
          setPlayerABuffer(next)
          return
        }

        if (payload.playerId === currentSnapshot.playerB.playerId) {
          const next = applyPayload(playerBBufferRef.current, payload.delta, payload.content)
          playerBBufferRef.current = next
          setPlayerBBuffer(next)
        }
      } catch {
        // Ignore malformed delta packets.
      }
    }

    const handleStatus = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as SpectatorStatus
        setStatus(payload)
      } catch {
        setStatus({ state: 'finished', reason: 'stream_closed' })
      }
    }

    source.addEventListener('snapshot', handleSnapshot)
    source.addEventListener('delta', handleDelta)
    source.addEventListener('status', handleStatus)

    source.onerror = () => {
      if (!snapshotRef.current) {
        setError('Unable to connect to live stream')
        setLoading(false)
      }
    }

    return () => {
      snapshotRef.current = null
      source.removeEventListener('snapshot', handleSnapshot)
      source.removeEventListener('delta', handleDelta)
      source.removeEventListener('status', handleStatus)
      source.close()
    }
  }, [matchId])

  useEffect(() => {
    if (!snapshot || !leftMountRef.current || !rightMountRef.current) return

    leftViewRef.current?.destroy()
    rightViewRef.current?.destroy()

    leftViewRef.current = new EditorView({
      state: createEditorState({
        content: playerABuffer,
        readOnly: true,
      }),
      parent: leftMountRef.current,
    })

    rightViewRef.current = new EditorView({
      state: createEditorState({
        content: playerBBuffer,
        readOnly: true,
      }),
      parent: rightMountRef.current,
    })

    return () => {
      leftViewRef.current?.destroy()
      rightViewRef.current?.destroy()
      leftViewRef.current = null
      rightViewRef.current = null
    }
  }, [snapshot?.matchId])

  useEffect(() => {
    replaceEditorContent(leftViewRef.current, playerABuffer)
  }, [playerABuffer])

  useEffect(() => {
    replaceEditorContent(rightViewRef.current, playerBBuffer)
  }, [playerBBuffer])

  useEffect(() => {
    if (!snapshot || status.state === 'finished') return

    const tick = () => {
      const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - snapshot.startedAt)
      setRoundSecondsLeft(Math.max(0, ROUND_DURATION_SEC - elapsed))
    }

    tick()
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [snapshot, status.state])

  const completionPercent = useMemo(() => {
    if (!snapshot) return 0

    const baselineChanged = findChangedLineIndexes(snapshot.targetCode, snapshot.pollutedCode).length
    if (baselineChanged <= 0) return 100

    const aRemaining = findChangedLineIndexes(snapshot.targetCode, playerABuffer).length
    const bRemaining = findChangedLineIndexes(snapshot.targetCode, playerBBuffer).length
    const aProgress = (baselineChanged - aRemaining) / baselineChanged
    const bProgress = (baselineChanged - bRemaining) / baselineChanged
    const average = Math.max(0, Math.min(1, (aProgress + bProgress) / 2))

    return Math.round(average * 100)
  }, [snapshot, playerABuffer, playerBBuffer])

  const finishReason = useMemo(() => {
    if (status.state !== 'finished') return ''

    switch (status.reason) {
      case 'player_finished':
        return 'Match finished: player completed the target'
      case 'opponent_disconnected':
        return 'Match finished: a player disconnected'
      case 'timeout_draw':
        return 'Match finished: time limit reached'
      default:
        return 'Match finished'
    }
  }, [status])

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="match-page live-spectate-match-page">
        {loading ? (
          <div className="matchmaking-screen">
            <div className="matchmaking-content">
              <h2 className="matchmaking-title">&gt;&gt; CONNECTING TO LIVE MATCH...</h2>
              <p className="matchmaking-status">Attaching spectator stream...</p>
            </div>
          </div>
        ) : error || !snapshot ? (
          <div className="matchmaking-screen">
            <div className="matchmaking-content">
              <h2 className="matchmaking-title">&gt;&gt; LIVE MATCH UNAVAILABLE</h2>
              <p className="matchmaking-status">{error || 'This match is no longer live.'}</p>
              <button className="cancel-btn" onClick={() => navigate(-1)}>
                ./BACK.sh
              </button>
            </div>
          </div>
        ) : (
          <div className="match-container">
            <div className="match-hud" aria-label="round progress">
              <div className={`match-hud-timer ${roundSecondsLeft <= 30 ? 'critical' : roundSecondsLeft <= 60 ? 'warning' : ''}`}>
                <span className="match-hud-timer-label">TIME</span>
                <span className="match-hud-timer-value">{formatRoundClock(roundSecondsLeft)}</span>
              </div>

              <div className="match-progress-group">
                <div className="match-progress-meta">
                  <span className="match-progress-label">PROGRESS</span>
                  <span className="match-progress-value">{completionPercent}%</span>
                </div>
                <div className="match-progress-track" aria-hidden="true">
                  <span className="match-progress-fill" style={{ width: `${completionPercent}%` }} />
                </div>
              </div>

              <div className="live-spectate-hud-actions">
                <button className="live-spectate-hud-back-btn" onClick={() => navigate(-1)}>
                  BACK
                </button>
              </div>
            </div>

            <div className="editor-grid">
              <EditorPanel
                filename="player_a.ts"
                panelTitle="LOCAL [YOU]"
                vimMode="SPECTATE"
                scrollWarningMessage="spectator mode is read-only"
                displayName={snapshot.playerA.displayName || 'Player A'}
                avatarUrl={snapshot.playerA.avatarUrl || ''}
                ref={leftMountRef}
              />

              <EditorPanel
                filename="opponent.ts"
                panelTitle="REMOTE [OPP]"
                scrollWarningMessage="spectator mode is read-only"
                displayName={snapshot.playerB.displayName || 'Player B'}
                avatarUrl={snapshot.playerB.avatarUrl || ''}
                ref={rightMountRef}
              />
            </div>

            {status.state === 'finished' && (
              <div className="live-spectate-finish-banner">{finishReason}</div>
            )}
          </div>
        )}
      </div>
    </TerminalLayout>
  )
}
