import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditorPanel } from '../../components/EditorPanel/EditorPanel'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { createSocketCallbacks } from '../typingChallenge/createSocketCallbacks'
import type { MatchState, ViewState } from '../typingChallenge/types'
import { useEditors } from '../typingChallenge/useEditors'
import { useGameSocket } from '../typingChallenge/useGameSocket'
import './MatchPage.css'

const initialMatchState: MatchState = {
  playerId: '',
  opponentId: '',
  matchId: '',
}

export default function MatchPage() {
  const [viewState, setViewState] = useState<ViewState>('matchmaking')
  const [statusText, setStatusText] = useState('Initializing...')
  const [vimMode, setVimMode] = useState('NORMAL')
  const [matchState, setMatchState] = useState<MatchState>(initialMatchState)
  const [resultText, setResultText] = useState('')
  const navigate = useNavigate()

  const targetCodeRef = useRef('')
  const pollutedCodeRef = useRef('')

  const viewStateRef = useRef(viewState)
  useEffect(() => {
    viewStateRef.current = viewState
  }, [viewState])

  const getViewState = useCallback(() => viewStateRef.current, [])

  const { connect, disconnect, sendBufferUpdate, sendPlayerFinished } = useGameSocket()
  const {
    leftRef,
    rightRef,
    cleanup: cleanupEditors,
    setEditors,
    replaceOpponentContent,
    getPlayerContent,
  } = useEditors()

  const finishSentRef = useRef(false)
  const beginMatchmakingRef = useRef<() => void>(() => {})

  useEffect(() => {
    beginMatchmakingRef.current()
  }, [])

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

  const cancelMatchmaking = () => {
    disconnect()
    cleanupEditors()
    navigate('/play')
  }

  const isMatchmaking = viewState === 'matchmaking'

  return (
    <TerminalLayout>

    <div className="match-page">
      {isMatchmaking ? (
        <div className="matchmaking-screen">
          <div className="matchmaking-content">
            <h2 className="matchmaking-title">&gt;&gt; SEARCHING FOR OPPONENT...</h2>
            <div className="matchmaking-anim">
              <span className="pulse-dot" />
            </div>
            <p className="matchmaking-status">{statusText}</p>
            <button className="secondary-btn" onClick={cancelMatchmaking}>
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
              ref={leftRef}
            />

            <EditorPanel
              filename="opponent.ts"
              panelTitle="REMOTE [OPP]"
              ref={rightRef}
            />
          </div>

          {resultText && <div className="result-banner">{resultText}</div>}
        </div>
      )}
    </div>
    </TerminalLayout>
  )
}