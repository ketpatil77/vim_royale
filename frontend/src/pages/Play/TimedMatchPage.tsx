import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useAuth } from '../../contexts/AuthContext'
import { useCRT } from '../../contexts/CRTContext'
import { useGuest } from '../../contexts/GuestContext'
import { useTimedGame } from '../../contexts/TimedGameContext'
import { useSingleEditor } from '../../hooks/useSingleEditor'
import { sounds } from '../../utils/sound'
import { completeTimedRun, saveTimedScore, setPendingTimedScore } from '../../utils/timedScores'
import './TimedMatchPage.css'

const TIMER_WARNING_THRESHOLD = 30

export default function TimedMatchPage() {
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()
  const { user } = useAuth()
  const { guest } = useGuest()
  const {
    status,
    difficulty,
    runToken,
    targetCode,
    pollutedCode,
    timeLeft,
    checkCompletion,
    resetGame,
    getTimeTaken,
    getBestScore,
    totalTime,
  } = useTimedGame()

  const [vimMode, setVimMode] = useState('NORMAL')
  const [showResult, setShowResult] = useState(false)
  const [showQuitWarning, setShowQuitWarning] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [runReadyForSave, setRunReadyForSave] = useState(false)
  const completionRequestedRef = useRef(false)

  const { editorRef, cleanup: cleanupEditor, setEditor } = useSingleEditor()

  useEffect(() => {
    if (status === 'idle') {
      navigate('/play/difficulty')
    }
  }, [status, navigate])

  useEffect(() => {
    if (status !== 'playing') return

    const handleContentChange = (content: string) => {
      const completed = checkCompletion(content)
      if (completed) {
        sounds.win.play()
      }
    }

    setEditor({ pollutedCode, onContentChange: handleContentChange }, setVimMode)
  }, [status, pollutedCode, setEditor, checkCompletion])

  useEffect(() => {
    return () => {
      cleanupEditor()
    }
  }, [cleanupEditor])

  useEffect(() => {
    if (status === 'timeout' || status === 'completed') {
      if (status === 'timeout') {
        sounds.lose.play()
      } else {
        sounds.win.play()
      }
      setShowResult(true)
    }
  }, [status])

  useEffect(() => {
    if (status === 'playing') {
      completionRequestedRef.current = false
      setRunReadyForSave(false)
      setSaveState('idle')
      return
    }
    if (status !== 'completed' || !runToken || completionRequestedRef.current) return

    completionRequestedRef.current = true
    completeTimedRun(runToken, guest?.sessionToken)
      .then(() => {
        setRunReadyForSave(true)
      })
      .catch(() => {
        setRunReadyForSave(false)
        setSaveState('error')
      })
  }, [status, runToken, guest?.sessionToken])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'playing') {
        e.preventDefault()
        e.returnValue = 'You are playing as a guest. Unsaved progress will be lost.'
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [status])

  const timerPercent = (timeLeft / totalTime) * 100
  const isTimerWarning = timeLeft <= TIMER_WARNING_THRESHOLD

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleMainMenu = () => {
    if (status === 'playing') {
      setShowQuitWarning(true)
      return
    }
    resetGame()
    setShowResult(false)
    navigate('/play')
  }

  const handleConfirmQuit = () => {
    resetGame()
    setShowResult(false)
    setShowQuitWarning(false)
    navigate('/play')
  }

  const handleReplay = () => {
    resetGame()
    setShowResult(false)
    navigate('/play/difficulty')
  }

  const currentBest = difficulty ? getBestScore(difficulty) : null
  const timeTaken = getTimeTaken()
  const isNewBest = timeTaken !== null && currentBest !== null && timeTaken <= currentBest.time

  const handleSaveScore = async () => {
    if (status !== 'completed' || !difficulty || !runToken || saveState === 'saving' || saveState === 'saved') {
      return
    }

    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    try {
      setSaveState('saving')
      if (!runReadyForSave) {
        await completeTimedRun(runToken, guest?.sessionToken)
        setRunReadyForSave(true)
      }
      await saveTimedScore(runToken, guest?.sessionToken)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  const handleLoginToSave = () => {
    if (status !== 'completed' || !runToken) return
    setPendingTimedScore({
      runToken,
      guestSessionToken: guest?.sessionToken,
      createdAt: Date.now(),
    })
    navigate('/login')
  }

  if (status === 'idle') {
    return null
  }

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="timed-match-page">
        <div className="timed-header">
          <div className="timed-difficulty-badge">
            [{difficulty?.toUpperCase()}]
          </div>
          <div className={`timed-timer ${isTimerWarning ? 'timed-timer--warning' : ''}`}>
            <div className="timed-timer-bar">
              <div
                className="timed-timer-fill"
                style={{ width: `${timerPercent}%` }}
              />
            </div>
            <span className="timed-timer-text">{formatTime(timeLeft)}</span>
          </div>
          <button className="timed-quit-btn" onClick={handleMainMenu}>
            ./QUIT.sh
          </button>
        </div>

        <div className="timed-match-container">
          <div className="timed-target-panel">
            <div className="timed-target-header">
              <span className="timed-target-label">&gt;&gt; TARGET CODE</span>
              <span className="timed-target-name">{difficulty}</span>
            </div>
            <pre className="timed-target-code">{targetCode}</pre>
          </div>

          <div className="timed-editor-panel">
            <div className="timed-editor-topbar">
              <div className="traffic-lights">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <span className="filename">polluted.ts</span>
            </div>
            <div ref={editorRef} className="timed-editor-mount" />
            <div className="vim-mode-badge">-- {vimMode} --</div>
          </div>
        </div>

        {showResult && (
          <div className="timed-result-overlay">
            <div className="timed-result-modal">
              <h2 className={`timed-result-title ${status === 'completed' ? 'success' : 'failure'}`}>
                {status === 'completed' ? '>> CHALLENGE COMPLETE' : '>> TIME UP'}
              </h2>
              {status === 'completed' && (
                <>
                  <div className="timed-result-stat">
                    <span className="stat-label">Time:</span>
                    <span className="stat-value">{formatTime(timeTaken || 0)}</span>
                  </div>
                  {isNewBest && (
                    <div className="timed-result-new-best">NEW BEST!</div>
                  )}
                  {!isNewBest && currentBest && (
                    <div className="timed-result-best">
                      Best: {formatTime(currentBest.time)}
                    </div>
                  )}
                  <div className="timed-result-save-row">
                    <button
                      className={`timed-result-btn ${saveState === 'saved' ? 'primary' : ''}`}
                      onClick={handleSaveScore}
                      disabled={saveState === 'saving' || saveState === 'saved'}
                    >
                      {saveState === 'saving'
                        ? 'SAVING...'
                        : saveState === 'saved'
                          ? 'SCORE SAVED'
                          : 'SAVE SCORE'}
                    </button>
                  </div>
                  {saveState === 'error' && (
                    <div className="timed-result-save-error">
                      Failed to save score. Try again.
                    </div>
                  )}
                </>
              )}
              {status === 'timeout' && (
                <div className="timed-result-timeout-msg">
                  Better luck next time!
                </div>
              )}
              <div className="timed-result-actions">
                <button className="timed-result-btn primary" onClick={handleReplay}>
                  REPLAY
                </button>
                <button className="timed-result-btn" onClick={handleMainMenu}>
                  MAIN MENU
                </button>
              </div>
            </div>
          </div>
        )}

        {showQuitWarning && (
          <div className="timed-result-overlay">
            <div className="timed-result-modal">
              <h2 className="timed-result-title failure">LEAVE GAME?</h2>
              <div className="timed-result-timeout-msg">
                {guest && !user
                  ? 'You are playing as a guest. Unsaved progress will be lost.'
                  : 'A game is in progress. Unsaved progress will be lost.'}
              </div>
              <div className="timed-result-actions">
                <button className="timed-result-btn primary" onClick={() => setShowQuitWarning(false)}>
                  KEEP PLAYING
                </button>
                <button className="timed-result-btn" onClick={handleConfirmQuit}>
                  LEAVE
                </button>
              </div>
            </div>
          </div>
        )}

        {showLoginPrompt && (
          <div className="timed-result-overlay">
            <div className="timed-result-modal">
              <h2 className="timed-result-title">SAVE SCORE</h2>
              <div className="timed-result-timeout-msg">
                Log in to save this score to your account.
              </div>
              <div className="timed-result-actions">
                <button className="timed-result-btn primary" onClick={handleLoginToSave}>
                  LOGIN TO SAVE
                </button>
                <button className="timed-result-btn" onClick={() => setShowLoginPrompt(false)}>
                  NOT NOW
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TerminalLayout>
  )
}
