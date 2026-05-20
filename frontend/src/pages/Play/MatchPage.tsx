import { useCallback, useEffect, useRef, useState } from 'react'
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
  useEffect(() => {
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

  const handlePlayerWon = useCallback(() => {
    sendPlayerFinishedWithKeystrokes({
      playerA: keystrokesRef.current.sent,
      playerB: keystrokesRef.current.received,
    })
  }, [sendPlayerFinishedWithKeystrokes])

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
      handlePlayerWon,
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
    handlePlayerWon,
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

  const handleContentChange = useCallback((_content: string, changes: any) => {
    if (viewStateRef.current !== 'playing') return

    const delta = changesToDelta(changes)
    sendBufferUpdate(undefined, delta)

    keystrokesRef.current.sent.push({
      ops: delta.ops,
      timestamp: Date.now(),
    })

    const content = getPlayerContent()
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

  const handleMainMenu = () => {
    navigate('/play')
  }

  const handleNewMatch = () => {
    beginMatchmaking()
  }

  const { crtEnabled, toggleCrt } = useCRT()

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (viewStateRef.current === 'playing') {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
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
