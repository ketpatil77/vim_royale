import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCRT } from '../contexts/CRTContext'
import { createSocketCallbacks } from './typingChallenge/createSocketCallbacks'
import type { MatchState, ViewState } from './typingChallenge/types'
import { useEditors } from './typingChallenge/useEditors'
import { useGameSocket } from './typingChallenge/useGameSocket'
import './TypingChallenge.css'

const initialMatchState: MatchState = {
  playerId: '',
  opponentId: '',
  matchId: '',
}

export default function Game() {
  const { crtEnabled, toggleCrt } = useCRT()
  const navigate = useNavigate()
  const [viewState, setViewState] = useState<ViewState>('idle')
  const [statusText, setStatusText] = useState('Click to start matchmaking')
  const [vimMode, setVimMode] = useState('NORMAL')
  const [matchState, setMatchState] = useState<MatchState>(initialMatchState)
  const [resultText, setResultText] = useState('')

  const targetCodeRef = useRef('')
  const pollutedCodeRef = useRef('')

  const viewStateRef = useRef(viewState)
  useEffect(() => {
    viewStateRef.current = viewState
  }, [viewState])

  const getViewState = useCallback(() => viewStateRef.current, [])

  const { connect, disconnect, sendBufferUpdate, sendPlayerFinished } = useGameSocket()
  const {
    targetRef,
    leftRef,
    rightRef,
    cleanup: cleanupEditors,
    setEditors,
    replaceOpponentContent,
    getPlayerContent,
  } = useEditors()

  const finishSentRef = useRef(false)
  const beginMatchmakingRef = useRef<() => void>(() => {})

  const handleContentChange = useCallback(() => {
    if (viewStateRef.current !== 'playing') return

    const content = getPlayerContent()
    sendBufferUpdate(content)

    if (!finishSentRef.current && content === targetCodeRef.current) {
      finishSentRef.current = true
      sendPlayerFinished()
    }
  }, [sendBufferUpdate, sendPlayerFinished, getPlayerContent])

  useEffect(() => {
    if (viewState === 'playing') {
      return setEditors(
        {
          targetCode: targetCodeRef.current,
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

  useEffect(() => {
    return () => {
      disconnect()
      cleanupEditors()
    }
  }, [disconnect, cleanupEditors])

  const beginMatchmaking = useCallback(() => {
    disconnect()
    cleanupEditors()

    finishSentRef.current = false
    targetCodeRef.current = ''
    pollutedCodeRef.current = ''

    setMatchState(initialMatchState)
    setResultText('')
    setStatusText('Connecting to matchmaking server...')
    setViewState('matchmaking')

    const callbacks = createSocketCallbacks(
      {
        setMatchState,
        setViewState,
        setStatusText,
        setResultText,
        setVimMode,
      },
      {
        targetCodeRef,
        pollutedCodeRef,
        finishSentRef,
      },
      matchState,
      replaceOpponentContent,
      () => beginMatchmakingRef.current(),
      getViewState
    )

    connect(callbacks)
  }, [disconnect, cleanupEditors, connect, replaceOpponentContent, matchState, getViewState])

  useEffect(() => {
    beginMatchmakingRef.current = () => {
      beginMatchmaking()
    }
  }, [beginMatchmaking])

  const playAgain = () => {
    beginMatchmaking()
  }

  const startMatchmaking = () => {
    beginMatchmaking()
  }

  const isError = viewState === 'error'
  const isMatchmaking = viewState === 'matchmaking'

  return (
    <div className="game-shell">
      <header className="terminal-topbar">
        <a href="/" className="cli-brand">root@vim-royale:~#</a>
        <nav className="cli-nav">
          <span onClick={() => navigate('/')}>{':home'}</span>
          <span onClick={() => navigate('/leaderboard')}>{':leaderboard'}</span>
          <span onClick={toggleCrt} style={{ cursor: 'pointer' }}>:crt: {crtEnabled ? 'on' : 'off'}</span>
        </nav>
      </header>

      <div className="match-container">
        <header className="target-panel">
          <div className="target-header-row">
            <div>
              <h2>&gt;&gt; REALTIME DIFF BATTLE</h2>
              <p>
                You: <strong>{matchState.playerId}</strong> | Opponent:{' '}
                <strong>{matchState.opponentId}</strong>
              </p>
            </div>
            <div className="status-stack">
              <span className="status-chip">{statusText}</span>
              {viewState === 'finished' && (
                <button className="secondary-btn" onClick={playAgain}>
                  ./PLAY_AGAIN.sh
                </button>
              )}
            </div>
          </div>
          <div ref={targetRef} className="target-mount" />
        </header>

        <div className="editor-grid">
          <section className="editor-panel">
            <div className="panel-title">LOCAL [YOU]</div>
            <div ref={leftRef} className="editor-mount" />
            <div className="vim-mode-badge">-- {vimMode} --</div>
          </section>

          <section className="editor-panel">
            <div className="panel-title">REMOTE [OPP]</div>
            <div ref={rightRef} className="editor-mount" />
          </section>
        </div>

        {resultText && <div className="result-banner">{resultText}</div>}
      </div>

      <div className="game-controls">
        <button 
          className="primary-btn btn" 
          onClick={startMatchmaking} 
          disabled={isMatchmaking || viewState === 'playing'}
        >
          {isMatchmaking ? './MATCHMAKING...' : isError ? './RETRY_MATCH.sh' : viewState === 'playing' ? './PLAYING...' : './PLAY_NOW.sh'}
        </button>
      </div>
    </div>
  )
}