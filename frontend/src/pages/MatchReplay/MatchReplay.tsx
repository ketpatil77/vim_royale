import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorView } from '@codemirror/view'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../../contexts/CRTContext'
import { convertOps, fetchMatchReplay, transformReplayData } from '../../utils/matchReplay'
import { createEditorState } from '../typingChallenge/editorState'
import type { CMOp, PlayerData } from '../../utils/matchReplay'
import './MatchReplay.css'

type ConvertedKeystrokeEntry = {
  ops: CMOp[]
  timestamp: number
}

type ConvertedPlayerData = {
  playerId: string
  displayName: string
  avatarUrl: string
  keystrokes: ConvertedKeystrokeEntry[]
}

interface ReplayEvent {
  timestamp: number
  playerIndex: 0 | 1
  ops: CMOp[]
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
    events.push({ timestamp: entry.timestamp, playerIndex: 0, ops: entry.ops })
  }
  for (const entry of p1.keystrokes) {
    events.push({ timestamp: entry.timestamp, playerIndex: 1, ops: entry.ops })
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

interface ReplayEditorPaneProps {
  label: string
  avatarUrl: string
  text: string
  playerIndex: 0 | 1
  charCount: number
  wpm: number
  finished: boolean
}

function ReplayEditorPane({ label, avatarUrl, text, playerIndex, charCount, wpm, finished }: ReplayEditorPaneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const view = new EditorView({
      state: createEditorState({
        content: text,
        readOnly: true,
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

  const [p0Text, setP0Text] = useState('')
  const [p1Text, setP1Text] = useState('')
  const [p0Chars, setP0Chars] = useState(0)
  const [p1Chars, setP1Chars] = useState(0)
  const [p0Wpm, setP0Wpm] = useState(0)
  const [p1Wpm, setP1Wpm] = useState(0)
  const [p0Finished, setP0Finished] = useState(false)
  const [p1Finished, setP1Finished] = useState(false)

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

  const timelineRef = useRef<ReplayEvent[]>([])
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
  }, [])

  const replayFromStartTo = useCallback((targetMs: number) => {
    const tl = timelineRef.current
    const base = startTsRef.current

    p0TextRef.current = baseTextRef.current
    p1TextRef.current = baseTextRef.current
    p0NetCharsRef.current = 0
    p1NetCharsRef.current = 0
    currentIdxRef.current = 0

    while (currentIdxRef.current < tl.length && tl[currentIdxRef.current].timestamp - base <= targetMs) {
      const ev = tl[currentIdxRef.current]
      if (ev.playerIndex === 0) {
        p0TextRef.current = applyDelta(p0TextRef.current, ev.ops)
        p0NetCharsRef.current += netCharsFromOps(ev.ops)
      } else {
        p1TextRef.current = applyDelta(p1TextRef.current, ev.ops)
        p1NetCharsRef.current += netCharsFromOps(ev.ops)
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
        p0TextRef.current = applyDelta(p0TextRef.current, ev.ops)
        p0NetCharsRef.current += netCharsFromOps(ev.ops)
      } else {
        p1TextRef.current = applyDelta(p1TextRef.current, ev.ops)
        p1NetCharsRef.current += netCharsFromOps(ev.ops)
      }
      currentIdxRef.current += 1
    }

    syncUiFromRefs(targetMs)
  }, [syncUiFromRefs])

  const setToTime = useCallback((targetMs: number) => {
    if (targetMs < elapsedRef.current) {
      replayFromStartTo(targetMs)
    } else {
      applyForwardTo(targetMs)
    }

    elapsedRef.current = targetMs
    setElapsedMs(targetMs)
  }, [applyForwardTo, replayFromStartTo])

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
          })),
        })

        const p0 = convertPlayer(transformed.p0)
        const p1 = convertPlayer(transformed.p1)
        const tl = buildTimeline(p0, p1)

        if (!tl.length) {
          timelineRef.current = []
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
              {matchId} · {timeline.length} events · {formatTime(duration)}
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
          />
          <ReplayEditorPane
            label={labels.p1}
            avatarUrl={avatars.p1}
            text={p1Text}
            playerIndex={1}
            charCount={p1Chars}
            wpm={p1Wpm}
            finished={p1Finished}
          />
        </div>

        <div className="match-replay-controls-wrap">
          <TimelineBar progress={progress} onSeek={seek} events={timeline} startTs={startTs} endTs={endTs} />

          <div className="match-replay-controls">
            <button className="replay-control-btn" onClick={resetPlayback}>reset</button>
            <button className="replay-control-btn replay-control-btn--primary" onClick={playing ? pause : play}>
              {playing ? 'pause' : 'play'}
            </button>

            <span className="match-replay-time">{formatTime(elapsedMs)} / {formatTime(duration)}</span>

            <div className="match-replay-speed-group">
              <span className="match-replay-speed-label">speed</span>
              {[1, 2, 4, 8].map((value) => (
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
