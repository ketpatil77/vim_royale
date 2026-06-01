import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorView, Decoration, type DecorationSet, WidgetType } from '@codemirror/view'
import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../../contexts/CRTContext'
import { convertOps, fetchMatchReplay, transformReplayData } from '../../utils/matchReplay'
import { createEditorState } from '../typingChallenge/editorState'
import { replayKeyDisplayLabel } from '../../utils/replayKeys'
import type { CMOp, PlayerData } from '../../utils/matchReplay'
import type { KeystrokeReplayMeta } from '../typingChallenge/types'
import './MatchReplay.css'

type ConvertedKeystrokeEntry = {
  ops: CMOp[]
  timestamp: number
  replay?: KeystrokeReplayMeta
}

type ConvertedPlayerData = {
  playerId: string
  displayName: string
  avatarUrl: string
  keystrokes: ConvertedKeystrokeEntry[]
}

type ReplayEventMeta = {
  keyRaw?: string
  keyDisplay?: string
  modeBefore?: string
  modeAfter?: string
  cursorOffset?: number
  cursorLine?: number
  cursorCol?: number
  bufferLineCount?: number
  viewportTopLine?: number
  viewportHeight?: number
}

interface ReplayEvent {
  timestamp: number
  playerIndex: 0 | 1
  ops: CMOp[]
  meta?: ReplayEventMeta
}

type KeyHistoryItem = {
  id: string
  display: string
  raw?: string
}

type PlayerOverlayState = {
  mode: string
  keyDisplay: string
  keyRaw: string
  cursorLine: number | null
  cursorCol: number | null
  cursorOffset: number | null
  bufferLineCount: number | null
  viewportTopLine: number | null
  viewportHeight: number | null
  keyHistory: KeyHistoryItem[]
  hasReplayMeta: boolean
}

type ReplayPlayerRuntime = {
  text: string
  netChars: number
  overlay: PlayerOverlayState
}

type ReplayCheckpoint = {
  idx: number
  elapsedMs: number
  p0: ReplayPlayerRuntime
  p1: ReplayPlayerRuntime
}

type CompressedKeyHistoryItem = {
  id: string
  display: string
  raw?: string
  count: number
  active: boolean
}

function createInitialOverlayState(): PlayerOverlayState {
  return {
    mode: 'UNKNOWN',
    keyDisplay: '—',
    keyRaw: '',
    cursorLine: null,
    cursorCol: null,
    cursorOffset: null,
    bufferLineCount: null,
    viewportTopLine: null,
    viewportHeight: null,
    keyHistory: [],
    hasReplayMeta: false,
  }
}

type ReplayCursorState = {
  offset: number
  mode: string
}

const setReplayCursorEffect = StateEffect.define<ReplayCursorState | null>({
  map: (value, change) => (value == null ? null : { ...value, offset: change.mapPos(value.offset) }),
})

class ReplayCursorWidget extends WidgetType {
  private readonly mode: string

  constructor(mode: string) {
    super()
    this.mode = mode
  }

  toDOM(): HTMLElement {
    const marker = document.createElement('span')
    const modeClass = `replay-cursor-widget--${this.mode.toLowerCase().replace(/\s+/g, '-')}`
    marker.className = `replay-cursor-widget ${modeClass}`
    marker.setAttribute('aria-hidden', 'true')
    return marker
  }
}

const replayCursorField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(markers, tr) {
    markers = markers.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setReplayCursorEffect)) {
        const cursor = effect.value
        if (cursor == null) {
          return Decoration.none
        }
        const safeOffset = Math.max(0, Math.min(tr.state.doc.length, cursor.offset))
        return Decoration.set([
          Decoration.widget({
            widget: new ReplayCursorWidget(cursor.mode),
            side: -1,
          }).range(safeOffset),
        ])
      }
    }
    return markers
  },
  provide: (field) => EditorView.decorations.from(field),
})

const replayCursorExtension: Extension = replayCursorField

function cloneOverlayState(overlay: PlayerOverlayState): PlayerOverlayState {
  return {
    ...overlay,
    keyHistory: [...overlay.keyHistory],
  }
}

function cloneRuntime(runtime: ReplayPlayerRuntime): ReplayPlayerRuntime {
  return {
    text: runtime.text,
    netChars: runtime.netChars,
    overlay: cloneOverlayState(runtime.overlay),
  }
}

function applyDelta(text: string, ops: CMOp[]): string {
  let result = ''
  let pos = 0

  for (const op of ops) {
    if ('retain' in op) {
      result += text.slice(pos, pos + op.retain)
      pos += op.retain
    } else if ('insert' in op) {
      result += op.insert
    } else if ('delete' in op) {
      pos += op.delete
    }
  }

  result += text.slice(pos)
  return result
}

function buildTimeline(p0: ConvertedPlayerData, p1: ConvertedPlayerData): ReplayEvent[] {
  const events: ReplayEvent[] = []

  for (const entry of p0.keystrokes) {
    events.push({ timestamp: entry.timestamp, playerIndex: 0, ops: entry.ops, meta: entry.replay })
  }
  for (const entry of p1.keystrokes) {
    events.push({ timestamp: entry.timestamp, playerIndex: 1, ops: entry.ops, meta: entry.replay })
  }

  events.sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return a.playerIndex - b.playerIndex
    }
    return a.timestamp - b.timestamp
  })

  return events
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function netCharsFromOps(ops: CMOp[]): number {
  let n = 0
  for (const op of ops) {
    if ('insert' in op) n += op.insert.length
  }
  return n
}

function lineCount(text: string): number {
  if (!text.length) return 1
  return text.split('\n').length
}

function readMetaCoverage(events: ReplayEvent[]): number {
  if (!events.length) return 0
  let covered = 0
  for (const event of events) {
    if (event.meta?.keyRaw || event.meta?.keyDisplay || event.meta?.modeAfter || event.meta?.cursorLine) {
      covered += 1
    }
  }
  return Math.round((covered / events.length) * 100)
}

function nextOverlayFromEvent(prev: PlayerOverlayState, event: ReplayEvent, fallbackText: string): PlayerOverlayState {
  const keyRaw = event.meta?.keyRaw || ''
  const keyDisplay = event.meta?.keyDisplay || replayKeyDisplayLabel(keyRaw, 'edit')
  const mode = event.meta?.modeAfter || prev.mode

  const nextHistory = [
    ...prev.keyHistory,
    {
      id: `${event.timestamp}-${event.playerIndex}-${prev.keyHistory.length}`,
      display: keyDisplay,
      raw: keyRaw || undefined,
    },
  ].slice(-10)

  return {
    mode: mode || 'UNKNOWN',
    keyDisplay,
    keyRaw,
    cursorLine: event.meta?.cursorLine ?? prev.cursorLine,
    cursorCol: event.meta?.cursorCol ?? prev.cursorCol,
    cursorOffset: event.meta?.cursorOffset ?? prev.cursorOffset,
    bufferLineCount: event.meta?.bufferLineCount ?? lineCount(fallbackText),
    viewportTopLine: event.meta?.viewportTopLine ?? prev.viewportTopLine,
    viewportHeight: event.meta?.viewportHeight ?? prev.viewportHeight,
    keyHistory: nextHistory,
    hasReplayMeta: prev.hasReplayMeta || !!(event.meta?.keyRaw || event.meta?.modeAfter || event.meta?.cursorLine),
  }
}

function applyEventToRuntime(runtime: ReplayPlayerRuntime, event: ReplayEvent): ReplayPlayerRuntime {
  const nextText = applyDelta(runtime.text, event.ops)
  return {
    text: nextText,
    netChars: runtime.netChars + netCharsFromOps(event.ops),
    overlay: nextOverlayFromEvent(runtime.overlay, event, nextText),
  }
}

function compressKeyHistory(history: KeyHistoryItem[]): CompressedKeyHistoryItem[] {
  if (!history.length) return []

  const compacted: CompressedKeyHistoryItem[] = []
  for (const item of history) {
    const prev = compacted[compacted.length - 1]
    if (prev && prev.display === item.display && prev.raw === item.raw) {
      prev.count += 1
      prev.active = false
      continue
    }
    compacted.push({
      id: item.id,
      display: item.display,
      raw: item.raw,
      count: 1,
      active: false,
    })
  }

  if (compacted.length) {
    compacted[compacted.length - 1].active = true
  }
  return compacted
}

function buildReplayCheckpoints(
  events: ReplayEvent[],
  baseTimestamp: number,
  baseText: string,
  checkpointEvery = 80
): ReplayCheckpoint[] {
  const checkpoints: ReplayCheckpoint[] = []
  let p0Runtime: ReplayPlayerRuntime = {
    text: baseText,
    netChars: 0,
    overlay: createInitialOverlayState(),
  }
  let p1Runtime: ReplayPlayerRuntime = {
    text: baseText,
    netChars: 0,
    overlay: createInitialOverlayState(),
  }

  checkpoints.push({
    idx: 0,
    elapsedMs: 0,
    p0: cloneRuntime(p0Runtime),
    p1: cloneRuntime(p1Runtime),
  })

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]
    if (event.playerIndex === 0) {
      p0Runtime = applyEventToRuntime(p0Runtime, event)
    } else {
      p1Runtime = applyEventToRuntime(p1Runtime, event)
    }

    const processedEvents = i + 1
    if (processedEvents % checkpointEvery === 0 || processedEvents === events.length) {
      checkpoints.push({
        idx: processedEvents,
        elapsedMs: Math.max(0, event.timestamp - baseTimestamp),
        p0: cloneRuntime(p0Runtime),
        p1: cloneRuntime(p1Runtime),
      })
    }
  }

  return checkpoints
}

function findCheckpointForTime(checkpoints: ReplayCheckpoint[], targetMs: number): ReplayCheckpoint {
  if (!checkpoints.length) {
    return {
      idx: 0,
      elapsedMs: 0,
      p0: { text: '', netChars: 0, overlay: createInitialOverlayState() },
      p1: { text: '', netChars: 0, overlay: createInitialOverlayState() },
    }
  }

  let lo = 0
  let hi = checkpoints.length - 1
  let best = 0

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (checkpoints[mid].elapsedMs <= targetMs) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return checkpoints[best]
}

interface ReplayEditorPaneProps {
  label: string
  avatarUrl: string
  text: string
  playerIndex: 0 | 1
  charCount: number
  wpm: number
  finished: boolean
  overlay: PlayerOverlayState
}

function ReplayEditorPane({
  label,
  avatarUrl,
  text,
  playerIndex,
  charCount,
  wpm,
  finished,
  overlay,
}: ReplayEditorPaneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const view = new EditorView({
      state: createEditorState({
        content: text,
        readOnly: true,
        extraExtensions: [replayCursorExtension],
      }),
      parent: mountRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Mount once, then update content in the dedicated effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const prevScrollTop = view.scrollDOM.scrollTop
    const current = view.state.doc.toString()
    if (current !== text) {
      view.dispatch({
        changes: {
          from: 0,
          to: current.length,
          insert: text,
        },
      })
    }

    view.scrollDOM.scrollTop = prevScrollTop
  }, [text])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const offset = overlay.cursorOffset
    const safeCursor =
      typeof offset === 'number'
        ? {
            offset: Math.max(0, Math.min(view.state.doc.length, offset)),
            mode: overlay.mode || 'UNKNOWN',
          }
        : null

    view.dispatch({
      effects: setReplayCursorEffect.of(safeCursor),
    })
  }, [overlay.cursorOffset, overlay.mode, text])

  const compressedKeyHistory = useMemo(() => compressKeyHistory(overlay.keyHistory), [overlay.keyHistory])

  return (
    <section className={`editor-panel replay-editor-panel replay-editor-panel--p${playerIndex}`}>
      <div className="editor-topbar replay-editor-topbar">
        <div className="traffic-lights">
          <span className="dot red" />
          <span className="dot yellow" />
          <span className="dot green" />
        </div>
        <span className="filename">{playerIndex === 0 ? 'winner.js' : 'loser.js'}</span>
      </div>

      <div className="replay-player-info-bar">
        <img
          src={avatarUrl || 'https://github.com/identicons/github.png'}
          alt={label}
          className="replay-player-avatar"
        />
        <span className="replay-player-name">{label}</span>
        {finished && <span className="replay-finished-chip">DONE</span>}
      </div>

      <div ref={mountRef} className="replay-editor-content replay-editor-mount" />

      <div className="replay-analysis-overlay" aria-live="polite">
        <div className="replay-analysis-top">
          <span className={`replay-mode-pill replay-mode-pill--${overlay.mode.toLowerCase().replace(/\s+/g, '-')}`}>
            {overlay.mode}
          </span>
          <span className="replay-key-current" title={overlay.keyRaw || undefined}>
            key: <b>{overlay.keyDisplay}</b>
          </span>
          {overlay.keyRaw && <span className="replay-key-raw">{overlay.keyRaw}</span>}
        </div>
        <div className="replay-key-tape">
          {compressedKeyHistory.length ? (
            compressedKeyHistory.map((item) => (
              <span
                key={item.id}
                className={`replay-key-chip ${item.active ? 'replay-key-chip--active' : ''}`}
                title={item.raw || item.display}
              >
                {item.count > 1 ? `${item.display} × ${item.count}` : item.display}
              </span>
            ))
          ) : (
            <span className="replay-key-tape-empty">No key metadata yet</span>
          )}
        </div>
      </div>

      <div className="replay-editor-stats">
        <span>
          chars: <b>{charCount}</b>
        </span>
        <span>
          wpm: <b>{wpm}</b>
        </span>
      </div>
    </section>
  )
}

interface TimelineBarProps {
  progress: number
  onSeek: (ratio: number) => void
  events: ReplayEvent[]
  startTs: number
  endTs: number
}

function TimelineBar({ progress, onSeek, events, startTs, endTs }: TimelineBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const duration = endTs - startTs || 1
  const ticks = useMemo(() => events.filter((_, idx) => idx % 4 === 0), [events])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return

    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(ratio)
  }

  return (
    <div ref={barRef} className="replay-timeline" onClick={handleClick}>
      {ticks.map((ev, i) => {
        const x = ((ev.timestamp - startTs) / duration) * 100
        return (
          <span
            key={`${ev.timestamp}-${ev.playerIndex}-${i}`}
            className={`replay-tick replay-tick--p${ev.playerIndex}`}
            style={{ left: `${x}%`, top: ev.playerIndex === 0 ? 4 : 20 }}
          />
        )
      })}

      <div className="replay-progress-fill" style={{ width: `${progress * 100}%` }} />
      <div className="replay-playhead" style={{ left: `${progress * 100}%` }} />
    </div>
  )
}

export default function MatchReplayPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()

  const [timeline, setTimeline] = useState<ReplayEvent[]>([])
  const [startTs, setStartTs] = useState(0)
  const [endTs, setEndTs] = useState(1)
  const [metaCoverage, setMetaCoverage] = useState(0)

  const [p0Text, setP0Text] = useState('')
  const [p1Text, setP1Text] = useState('')
  const [p0Chars, setP0Chars] = useState(0)
  const [p1Chars, setP1Chars] = useState(0)
  const [p0Wpm, setP0Wpm] = useState(0)
  const [p1Wpm, setP1Wpm] = useState(0)
  const [p0Finished, setP0Finished] = useState(false)
  const [p1Finished, setP1Finished] = useState(false)
  const [p0Overlay, setP0Overlay] = useState<PlayerOverlayState>(createInitialOverlayState)
  const [p1Overlay, setP1Overlay] = useState<PlayerOverlayState>(createInitialOverlayState)

  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const [elapsedMs, setElapsedMs] = useState(0)

  const [labels, setLabels] = useState({ p0: 'Player 1', p1: 'Player 2' })
  const [avatars, setAvatars] = useState({ p0: '', p1: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const playingRef = useRef(false)
  const speedRef = useRef(2)
  const elapsedRef = useRef(0)
  const lastRealTimeRef = useRef(0)

  const p0TextRef = useRef('')
  const p1TextRef = useRef('')
  const baseTextRef = useRef('')
  const p0NetCharsRef = useRef(0)
  const p1NetCharsRef = useRef(0)
  const currentIdxRef = useRef(0)
  const p0OverlayRef = useRef<PlayerOverlayState>(createInitialOverlayState())
  const p1OverlayRef = useRef<PlayerOverlayState>(createInitialOverlayState())

  const timelineRef = useRef<ReplayEvent[]>([])
  const checkpointsRef = useRef<ReplayCheckpoint[]>([])
  const startTsRef = useRef(0)
  const endTsRef = useRef(1)
  const p0LastOffsetRef = useRef(-1)
  const p1LastOffsetRef = useRef(-1)

  const rafRef = useRef(0)

  const syncUiFromRefs = useCallback((gameCursorMs: number) => {
    const p0 = p0TextRef.current
    const p1 = p1TextRef.current

    setP0Text(p0)
    setP1Text(p1)
    setP0Chars(p0.length)
    setP1Chars(p1.length)

    const elapsedMinutes = Math.max(gameCursorMs, 1000) / 60_000
    setP0Wpm(Math.round((p0NetCharsRef.current / 5) / elapsedMinutes))
    setP1Wpm(Math.round((p1NetCharsRef.current / 5) / elapsedMinutes))

    setP0Finished(p0LastOffsetRef.current >= 0 && gameCursorMs >= p0LastOffsetRef.current)
    setP1Finished(p1LastOffsetRef.current >= 0 && gameCursorMs >= p1LastOffsetRef.current)
    setP0Overlay(p0OverlayRef.current)
    setP1Overlay(p1OverlayRef.current)
  }, [])

  const restoreFromCheckpointTo = useCallback((targetMs: number) => {
    const tl = timelineRef.current
    const base = startTsRef.current
    const checkpoint = findCheckpointForTime(checkpointsRef.current, targetMs)

    p0TextRef.current = checkpoint.p0.text
    p1TextRef.current = checkpoint.p1.text
    p0NetCharsRef.current = checkpoint.p0.netChars
    p1NetCharsRef.current = checkpoint.p1.netChars
    p0OverlayRef.current = cloneOverlayState(checkpoint.p0.overlay)
    p1OverlayRef.current = cloneOverlayState(checkpoint.p1.overlay)
    currentIdxRef.current = checkpoint.idx

    while (currentIdxRef.current < tl.length && tl[currentIdxRef.current].timestamp - base <= targetMs) {
      const ev = tl[currentIdxRef.current]
      if (ev.playerIndex === 0) {
        const next = applyEventToRuntime(
          { text: p0TextRef.current, netChars: p0NetCharsRef.current, overlay: p0OverlayRef.current },
          ev
        )
        p0TextRef.current = next.text
        p0NetCharsRef.current = next.netChars
        p0OverlayRef.current = next.overlay
      } else {
        const next = applyEventToRuntime(
          { text: p1TextRef.current, netChars: p1NetCharsRef.current, overlay: p1OverlayRef.current },
          ev
        )
        p1TextRef.current = next.text
        p1NetCharsRef.current = next.netChars
        p1OverlayRef.current = next.overlay
      }
      currentIdxRef.current += 1
    }

    syncUiFromRefs(targetMs)
  }, [syncUiFromRefs])

  const applyForwardTo = useCallback((targetMs: number) => {
    const tl = timelineRef.current
    const base = startTsRef.current

    while (currentIdxRef.current < tl.length && tl[currentIdxRef.current].timestamp - base <= targetMs) {
      const ev = tl[currentIdxRef.current]
      if (ev.playerIndex === 0) {
        const next = applyEventToRuntime(
          { text: p0TextRef.current, netChars: p0NetCharsRef.current, overlay: p0OverlayRef.current },
          ev
        )
        p0TextRef.current = next.text
        p0NetCharsRef.current = next.netChars
        p0OverlayRef.current = next.overlay
      } else {
        const next = applyEventToRuntime(
          { text: p1TextRef.current, netChars: p1NetCharsRef.current, overlay: p1OverlayRef.current },
          ev
        )
        p1TextRef.current = next.text
        p1NetCharsRef.current = next.netChars
        p1OverlayRef.current = next.overlay
      }
      currentIdxRef.current += 1
    }

    syncUiFromRefs(targetMs)
  }, [syncUiFromRefs])

  const setToTime = useCallback((targetMs: number) => {
    if (targetMs < elapsedRef.current) {
      restoreFromCheckpointTo(targetMs)
    } else {
      applyForwardTo(targetMs)
    }

    elapsedRef.current = targetMs
    setElapsedMs(targetMs)
  }, [applyForwardTo, restoreFromCheckpointTo])

  const pause = useCallback(() => {
    playingRef.current = false
    cancelAnimationFrame(rafRef.current)
    setPlaying(false)
  }, [])

  const resetPlayback = useCallback(() => {
    pause()
    p0TextRef.current = baseTextRef.current
    p1TextRef.current = baseTextRef.current
    p0NetCharsRef.current = 0
    p1NetCharsRef.current = 0
    currentIdxRef.current = 0
    p0OverlayRef.current = createInitialOverlayState()
    p1OverlayRef.current = createInitialOverlayState()
    elapsedRef.current = 0
    setElapsedMs(0)
    syncUiFromRefs(0)
  }, [pause, syncUiFromRefs])

  useEffect(() => {
    if (!matchId) {
      setError('No match ID provided')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetchMatchReplay(matchId)
      .then((data) => {
        const transformed = transformReplayData(data)
        const polluted = typeof data.pollutedCode === 'string' ? data.pollutedCode : ''
        const target = typeof data.targetCode === 'string' ? data.targetCode : ''
        baseTextRef.current = polluted || target || ''

        const convertPlayer = (p: PlayerData): ConvertedPlayerData => ({
          playerId: p.playerId,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          keystrokes: p.keystrokes.map((entry) => ({
            timestamp: entry.timestamp,
            ops: convertOps(entry.ops),
            replay: {
              keyRaw: entry.keyRaw,
              keyDisplay: entry.keyDisplay,
              modeBefore: entry.modeBefore,
              modeAfter: entry.modeAfter,
              cursorOffset: entry.cursorOffset,
              cursorLine: entry.cursorLine,
              cursorCol: entry.cursorCol,
              bufferLineCount: entry.bufferLineCount,
              viewportTopLine: entry.viewportTopLine,
              viewportHeight: entry.viewportHeight,
            },
          })),
        })

        const p0 = convertPlayer(transformed.p0)
        const p1 = convertPlayer(transformed.p1)
        const tl = buildTimeline(p0, p1)

        setMetaCoverage(readMetaCoverage(tl))

        if (!tl.length) {
          timelineRef.current = []
          checkpointsRef.current = []
          startTsRef.current = 0
          endTsRef.current = 1
          p0LastOffsetRef.current = -1
          p1LastOffsetRef.current = -1

          setTimeline([])
          setStartTs(0)
          setEndTs(1)
          setLabels({ p0: p0.displayName, p1: p1.displayName })
          setAvatars({ p0: p0.avatarUrl, p1: p1.avatarUrl })
          resetPlayback()
          setLoading(false)
          return
        }

        const first = tl[0].timestamp
        const last = tl[tl.length - 1].timestamp

        const p0LastOffset = p0.keystrokes.length ? p0.keystrokes[p0.keystrokes.length - 1].timestamp - first : -1
        const p1LastOffset = p1.keystrokes.length ? p1.keystrokes[p1.keystrokes.length - 1].timestamp - first : -1

        timelineRef.current = tl
        checkpointsRef.current = buildReplayCheckpoints(tl, first, baseTextRef.current)
        startTsRef.current = first
        endTsRef.current = last
        p0LastOffsetRef.current = p0LastOffset
        p1LastOffsetRef.current = p1LastOffset

        setTimeline(tl)
        setStartTs(first)
        setEndTs(last)
        setLabels({ p0: p0.displayName, p1: p1.displayName })
        setAvatars({ p0: p0.avatarUrl, p1: p1.avatarUrl })

        resetPlayback()
        setLoading(false)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load replay'
        setError(message)
        setLoading(false)
      })
  }, [matchId, resetPlayback])

  const tick = useCallback((realNow: number) => {
    if (!playingRef.current) return

    const delta = realNow - lastRealTimeRef.current
    lastRealTimeRef.current = realNow

    const duration = endTsRef.current - startTsRef.current
    const nextElapsed = Math.min(duration, elapsedRef.current + delta * speedRef.current)

    setToTime(nextElapsed)

    if (nextElapsed >= duration) {
      playingRef.current = false
      setPlaying(false)
      return
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [setToTime])

  const play = useCallback(() => {
    if (!timelineRef.current.length || playingRef.current) return

    const duration = endTsRef.current - startTsRef.current
    if (elapsedRef.current >= duration) {
      setToTime(0)
    }

    playingRef.current = true
    lastRealTimeRef.current = performance.now()
    setPlaying(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [setToTime, tick])

  const seek = useCallback((ratio: number) => {
    const duration = endTsRef.current - startTsRef.current
    const target = Math.max(0, Math.min(duration, ratio * duration))
    setToTime(target)
    if (playingRef.current) {
      lastRealTimeRef.current = performance.now()
    }
  }, [setToTime])

  const stepBy = useCallback((step: -1 | 1) => {
    pause()
    const tl = timelineRef.current
    if (!tl.length) return

    const base = startTsRef.current
    const currentEventIdx = currentIdxRef.current - 1
    const targetEventIdx = currentEventIdx + step

    if (targetEventIdx < 0) {
      setToTime(0)
      return
    }

    const clamped = Math.min(tl.length - 1, targetEventIdx)
    const targetMs = Math.max(0, tl[clamped].timestamp - base)
    setToTime(targetMs)
  }, [pause, setToTime])

  const changeSpeed = (nextSpeed: number) => {
    speedRef.current = nextSpeed
    setSpeed(nextSpeed)
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const duration = endTs - startTs
  const progress = duration > 0 ? elapsedMs / duration : 0

  if (loading) {
    return (
      <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
        <div className="match-replay-page">
          <div className="match-replay-feedback">Loading replay...</div>
        </div>
      </TerminalLayout>
    )
  }

  if (error) {
    return (
      <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
        <div className="match-replay-page">
          <div className="match-replay-feedback match-replay-feedback--error">{error}</div>
        </div>
      </TerminalLayout>
    )
  }

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="match-replay-page">
        <div className="match-replay-header">
          <div>
            <div className="match-replay-title">&gt;&gt; MATCH REPLAY</div>
            <div className="match-replay-meta">
              {matchId} · {timeline.length} events · {formatTime(duration)} · replay metadata {metaCoverage}%
            </div>
          </div>
          <button className="match-replay-back-btn" onClick={() => navigate('/play')}>
            ./BACK.sh
          </button>
        </div>

        <div className="editor-grid replay-editor-grid">
          <ReplayEditorPane
            label={labels.p0}
            avatarUrl={avatars.p0}
            text={p0Text}
            playerIndex={0}
            charCount={p0Chars}
            wpm={p0Wpm}
            finished={p0Finished}
            overlay={p0Overlay}
          />
          <ReplayEditorPane
            label={labels.p1}
            avatarUrl={avatars.p1}
            text={p1Text}
            playerIndex={1}
            charCount={p1Chars}
            wpm={p1Wpm}
            finished={p1Finished}
            overlay={p1Overlay}
          />
        </div>

        <div className="match-replay-controls-wrap">
          <TimelineBar progress={progress} onSeek={seek} events={timeline} startTs={startTs} endTs={endTs} />

          <div className="match-replay-controls">
            <button className="replay-control-btn" onClick={resetPlayback}>reset</button>
            <button className="replay-control-btn" onClick={() => stepBy(-1)}>{'<<'} step</button>
            <button className="replay-control-btn replay-control-btn--primary" onClick={playing ? pause : play}>
              {playing ? 'pause' : 'play'}
            </button>
            <button className="replay-control-btn" onClick={() => stepBy(1)}>step {'>>'}</button>

            <span className="match-replay-time">{formatTime(elapsedMs)} / {formatTime(duration)}</span>

            <div className="match-replay-speed-group">
              <span className="match-replay-speed-label">speed</span>
              {[0.5, 1, 2, 4].map((value) => (
                <button
                  key={value}
                  className={`replay-control-btn ${speed === value ? 'replay-control-btn--active' : ''}`}
                  onClick={() => changeSpeed(value)}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TerminalLayout>
  )
}
