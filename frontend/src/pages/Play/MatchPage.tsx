import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useCRT } from '../../contexts/CRTContext'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EditorPanel } from '../../components/EditorPanel/EditorPanel'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import MatchResultModal, { parseResult } from '../../components/MatchResultModal/MatchResultModal'
import { createSocketCallbacks } from '../typingChallenge/createSocketCallbacks'
import type { MatchState, ViewState, GameOverPayload, KeystrokeEntry } from '../typingChallenge/types'
import { useEditors } from '../typingChallenge/useEditors'
import { useGameSocket } from '../typingChallenge/useGameSocket'
import { sounds } from '../../utils/sound'
import { WS_URL } from '../../config'
import './MatchPage.css'

const initialMatchState: MatchState = {
  playerId: '',
  opponentId: '',
  opponentName: '',
  opponentAvatar: '',
  opponentRating: 0,
  opponentIsBot: false,
  matchId: '',
  roundDurationSec: 180,
}

const shouldWarnBeforeLeaving = (state: ViewState) => state === 'countdown' || state === 'playing'
const activeMatchLeaveWarning = 'A match is currently in progress.'
const defaultRoundDurationSec = 180

const normalizeLines = (value: string) => value.replace(/\r\n/g, '\n').split('\n')

const findChangedLineIndexes = (targetCode: string, pollutedCode: string): number[] => {
  const targetLines = normalizeLines(targetCode)
  const pollutedLines = normalizeLines(pollutedCode)
  const max = Math.max(targetLines.length, pollutedLines.length)
  const changed: number[] = []

  for (let i = 0; i < max; i += 1) {
    if ((targetLines[i] || '') !== (pollutedLines[i] || '')) {
      changed.push(i)
    }
  }

  return changed
}

const formatRoundClock = (seconds: number): string => {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

type MatchPageProps = {
  mode?: 'multiplayer' | 'computer'
}

export default function MatchPage({ mode = 'multiplayer' }: MatchPageProps) {
  const [viewState, setViewState] = useState<ViewState>('matchmaking')
  const [countdown, setCountdown] = useState(3)
  const [statusText, setStatusText] = useState('Initializing...')
  const [vimMode, setVimMode] = useState('NORMAL')
  const [matchState, setMatchState] = useState<MatchState>(initialMatchState)
  const [resultText, setResultText] = useState('')
  const [gameOverPayload, setGameOverPayload] = useState<GameOverPayload | null>(null)
  const [roundSecondsLeft, setRoundSecondsLeft] = useState(defaultRoundDurationSec)
  const [playerContent, setPlayerContent] = useState('')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const selectedBotId = searchParams.get('botId') || ''
  const isComputerMode = mode === 'computer'

  const targetCodeRef = useRef('')
  const pollutedCodeRef = useRef('')

  const keystrokesRef = useRef<{ sent: KeystrokeEntry[]; received: KeystrokeEntry[] }>({
    sent: [],
    received: [],
  })

  const viewStateRef = useRef(viewState)
  useLayoutEffect(() => {
    viewStateRef.current = viewState
  }, [viewState])

  useEffect(() => {
    if (viewState !== 'countdown') return

    setCountdown(3)
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setViewState('playing')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [viewState])

  const getViewState = useCallback(() => viewStateRef.current, [])

  const { connect, disconnect, sendBufferUpdate, sendPlayerFinishedWithKeystrokes } = useGameSocket()
  const {
    leftRef,
    rightRef,
    cleanup: cleanupEditors,
    setEditors,
    replaceOpponentContent,
    applyDelta,
    changesToDelta,
    getPlayerContent,
  } = useEditors()

  const finishSentRef = useRef(false)

  const recordReceivedKeystroke = useCallback((delta: { ops: any[] }) => {
    if (viewStateRef.current !== 'playing') return
    keystrokesRef.current.received.push({
      ops: delta.ops,
      timestamp: Date.now(),
    })
  }, [])

  const playSound = useCallback((type: 'win' | 'lose') => {
    sounds[type].play()
  }, [])

  const beginMatchmaking = useCallback(() => {
    if (isComputerMode && !selectedBotId) {
      setStatusText('Missing bot selection. Redirecting...')
      navigate('/play/computer')
      return
    }

    disconnect()
    cleanupEditors()

    finishSentRef.current = false
    targetCodeRef.current = ''
    pollutedCodeRef.current = ''

    setMatchState(initialMatchState)
    setResultText('')
    setGameOverPayload(null)
    setRoundSecondsLeft(defaultRoundDurationSec)
    setPlayerContent('')
    setStatusText(isComputerMode ? 'Connecting to bot server...' : 'Connecting to matchmaking server...')
    setViewState('matchmaking')

    const callbacks = createSocketCallbacks(
      {
        setMatchState,
        setViewState,
        setStatusText,
        setResultText,
        setVimMode,
        setGameOverPayload,
        playSound,
      },
      {
        targetCodeRef,
        pollutedCodeRef,
        finishSentRef,
      },
      { playerId: matchState.playerId },
      replaceOpponentContent,
      applyDelta,
      recordReceivedKeystroke,
      () => beginMatchmaking(),
      getViewState
    )

    const wsUrl = isComputerMode
      ? `${WS_URL}?botId=${encodeURIComponent(selectedBotId)}`
      : WS_URL

    connect(callbacks, { wsUrl })
  }, [
    isComputerMode,
    selectedBotId,
    navigate,
    disconnect,
    cleanupEditors,
    playSound,
    matchState.playerId,
    replaceOpponentContent,
    applyDelta,
    recordReceivedKeystroke,
    getViewState,
    connect,
  ])

  useEffect(() => {
    beginMatchmaking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
      cleanupEditors()
    }
  }, [disconnect, cleanupEditors])

  useEffect(() => {
    if (viewState === 'playing') {
      keystrokesRef.current = { sent: [], received: [] }
    }
  }, [viewState])

  useEffect(() => {
    if (isComputerMode) return

    if (viewState === 'countdown') {
      setRoundSecondsLeft(matchState.roundDurationSec || defaultRoundDurationSec)
      return
    }

    if (viewState !== 'playing') return

    const duration = matchState.roundDurationSec || defaultRoundDurationSec
    setRoundSecondsLeft(duration)
    const deadlineAt = Date.now() + duration * 1000

    const interval = window.setInterval(() => {
      const remainingMs = deadlineAt - Date.now()
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
      setRoundSecondsLeft(remainingSeconds)
      if (remainingSeconds <= 0) {
        window.clearInterval(interval)
      }
    }, 250)

    return () => window.clearInterval(interval)
  }, [isComputerMode, viewState, matchState.roundDurationSec])

  useEffect(() => {
    if (viewState !== 'playing' || !leftRef.current) return

    const editorMount = leftRef.current
    const preventPaste = (event: Event) => {
      event.preventDefault()
    }

    const preventPasteBeforeInput = (event: Event) => {
      if (event instanceof InputEvent && event.inputType === 'insertFromPaste') {
        event.preventDefault()
      }
    }

    editorMount.addEventListener('paste', preventPaste, true)
    editorMount.addEventListener('beforeinput', preventPasteBeforeInput, true)

    return () => {
      editorMount.removeEventListener('paste', preventPaste, true)
      editorMount.removeEventListener('beforeinput', preventPasteBeforeInput, true)
    }
  }, [viewState, leftRef])

  const handleContentChange = useCallback((_content: string, changes: any) => {
    if (viewStateRef.current !== 'playing') return

    const delta = changesToDelta(changes)
    sendBufferUpdate(undefined, delta)

    keystrokesRef.current.sent.push({
      ops: delta.ops,
      timestamp: Date.now(),
    })

    const content = getPlayerContent()
    setPlayerContent(content)
    if (!finishSentRef.current && content === targetCodeRef.current) {
      finishSentRef.current = true
      const keystrokes: KeystrokeEntry[] = keystrokesRef.current.sent
      sendPlayerFinishedWithKeystrokes({
        playerA: keystrokes,
        playerB: keystrokesRef.current.received,
      })
    }
  }, [sendBufferUpdate, getPlayerContent, changesToDelta, sendPlayerFinishedWithKeystrokes])

  useEffect(() => {
    if (viewState === 'playing') {
      setPlayerContent(pollutedCodeRef.current)
      return setEditors(
        {
          pollutedCode: pollutedCodeRef.current,
          onContentChange: handleContentChange,
        },
        setVimMode
      )
    }

    if (viewState !== 'finished') {
      cleanupEditors()
    }
  }, [viewState, setEditors, handleContentChange, cleanupEditors])

  const cancelMatchmaking = () => {
    disconnect()
    cleanupEditors()
    navigate(isComputerMode ? '/play/computer' : '/play')
  }

  const isMatchmaking = viewState === 'matchmaking'
  const showMatchHud = !isComputerMode && (viewState === 'playing' || viewState === 'countdown')
  const currentPlayerBuffer = (viewState === 'playing' || viewState === 'finished')
    ? playerContent
    : pollutedCodeRef.current

  const baselineChangedLines = useMemo(
    () => findChangedLineIndexes(targetCodeRef.current, pollutedCodeRef.current),
    [matchState.matchId]
  )

  const currentChangedLines = useMemo(() => {
    if (!targetCodeRef.current) return []
    const current = currentPlayerBuffer
    return findChangedLineIndexes(targetCodeRef.current, current)
  }, [currentPlayerBuffer, matchState.matchId])

  const totalChecks = baselineChangedLines.length
  const completedChecks = Math.max(0, totalChecks - currentChangedLines.length)
  const completionRatio = totalChecks > 0 ? completedChecks / totalChecks : 1
  const completionPercent = Math.round(completionRatio * 100)

  const handleMainMenu = () => {
    navigate('/play')
  }

  const handleNewMatch = () => {
    beginMatchmaking()
  }

  const { crtEnabled, toggleCrt } = useCRT()

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!shouldWarnBeforeLeaving(viewStateRef.current)) {
        return
      }

      e.preventDefault()
      e.returnValue = activeMatchLeaveWarning
      return activeMatchLeaveWarning
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.onbeforeunload = handleBeforeUnload

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (window.onbeforeunload === handleBeforeUnload) {
        window.onbeforeunload = null
      }
    }
  }, [])

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="match-page">
        {isMatchmaking ? (
          <div className="matchmaking-screen">
            <div className="matchmaking-content">
              <h2 className="matchmaking-title">
                {isComputerMode ? '>> PREPARING BOT DUEL...' : '>> SEARCHING FOR OPPONENT...'}
              </h2>
              <div className="matchmaking-anim">
                <svg className="magnifying-glass" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="7" stroke="var(--green)" strokeWidth="2"/>
                  <path d="M16 16L20 20" stroke="var(--green)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="matchmaking-status">{statusText}</p>
              <button className="cancel-btn" onClick={cancelMatchmaking}>
                ./CANCEL.sh
              </button>
            </div>
          </div>
        ) : (
          <div className="match-container">
            {showMatchHud && (
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
              </div>
            )}

            <div className="editor-grid">
              <EditorPanel
                filename="vim_royale.ts"
                panelTitle="LOCAL [YOU]"
                vimMode={vimMode}
                scrollWarningMessage="use keyboard to navigate, scroll wheel is disabled"
                displayName={user?.displayName || 'You'}
                avatarUrl={user?.avatarUrl || ''}
                rating={Math.round(user?.rating || 0)}
                ref={leftRef}
              />

              <EditorPanel
                filename="opponent.ts"
                panelTitle={matchState.opponentIsBot ? 'BOT [AI]' : 'REMOTE [OPP]'}
                scrollWarningMessage="use keyboard to navigate, scroll wheel is disabled"
                displayName={matchState.opponentName || (matchState.opponentIsBot ? 'Bot' : 'Opponent')}
                avatarUrl={matchState.opponentAvatar || ''}
                rating={matchState.opponentRating}
                ref={rightRef}
              />
            </div>

            {viewState === 'countdown' && (
              <div className="countdown-overlay">
                <div className="countdown-number">{countdown}</div>
              </div>
            )}

            {viewState === 'finished' && gameOverPayload && (
              <MatchResultModal
                isOpen={true}
                {...parseResult(resultText, gameOverPayload)}
                onMainMenu={handleMainMenu}
                onNewMatch={handleNewMatch}
              />
            )}
          </div>
        )}
      </div>
    </TerminalLayout>
  )
}
