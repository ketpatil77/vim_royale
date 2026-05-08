import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './TypingChallenge.css'
import { createSocketCallbacks } from './typingChallenge/createSocketCallbacks'
import type { MatchState, ViewState } from './typingChallenge/types'
import { useEditors } from './typingChallenge/useEditors'
import { useGameSocket } from './typingChallenge/useGameSocket'
import { useAuth } from '../contexts/AuthContext'

const initialMatchState: MatchState = {
  playerId: '',
  opponentId: '',
  matchId: '',
}

const localPreview = [
  '1  function calculateTotal(items) {',
  '2    let total = 0;',
  '3    items.forEach(item => {',
  '4      total += item.price;',
  '5    });',
  '6    return total;',
  '7  }',
]

const remotePreview = [
  '1  function calcTotal(items) {',
  '2    var sum = 0;',
  '3    // TODO: fix logic here',
  '4    return -1;',
  '5  }',
]

export default function TypingChallenge() {
  const { user, logout } = useAuth()
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

  if (viewState === 'playing' || viewState === 'finished') {
    return (
      <div className="challenge-shell">
        <header className="terminal-topbar">
          <a href="/" className="cli-brand">root@vim-royale:~#</a>
          <nav className="cli-nav">
            <span>:leaderboard</span>
            <span>:docs</span>
            <span>:login</span>
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
      </div>
    )
  }

  const isError = viewState === 'error'
  const isMatchmaking = viewState === 'matchmaking'

  return (
    <div className="challenge-shell">
      <header className="terminal-topbar">
        <div className="cli-brand">root@vim-royale:~#</div>
        <nav className="cli-nav">
          <span>:leaderboard</span>
          <span>:docs</span>
          {user ? (
            <span
              onClick={async () => {
                await logout()
                navigate('/login')
              }}
              style={{ cursor: 'pointer' }}
            >
              :logout [{user.email}]
            </span>
          ) : (
            <span
              onClick={() => navigate('/login')}
              style={{ cursor: 'pointer' }}
            >
              :login
            </span>
          )}
          {user && (
            <span
              onClick={() => navigate('/userProfile')}
              style={{ cursor: 'pointer' }}
            >
              :profile
            </span>
          )}
        </nav>
      </header>

      <main className="landing-shell">
        <section className="hero-block">
          <h1 className="hero-title">VIM ROYALE</h1>

          <div className="hero-message">
            <p className="hero-tag">&gt; One Shall Vim, One Shall Lose</p>
            <p>
              Battle other developers in real-time. Fix broken code. <span className="inline-chip">:wq</span>{' '}
              for glory.
            </p>
          </div>

          <div className="hero-actions">
            <button className="primary-btn btn" onClick={startMatchmaking} disabled={isMatchmaking}>
              {isMatchmaking ? './MATCHMAKING...' : isError ? './RETRY_MATCH.sh' : './PLAY_NOW.sh'}
            </button>
            <button className="secondary-btn btn" type="button">
              MAN PRACTICE
            </button>
          </div>

          <div className="status-strip" role="status" aria-live="polite">
            <span className="strip-title">SYSTEM STATUS</span>
            <span>MATCHES_PLAYED: <code className='status-inline'>10,420</code></span>
            <span>LINES_RM: <code className='status-inline'>1,024,512</code></span>
            <span>AVG_APM: <code className='status-inline'>142</code></span>
            <span>
              LATENCY: <code className='status-inline'>20ms</code>
            </span>
          </div>

          <p className={`lobby-status ${isError ? 'error' : ''}`}>{statusText}</p>
          {matchState.playerId && <p className="meta">PLAYER_ID: {matchState.playerId}</p>}
        </section>

        <section className="content-panel">
          <div className="section-head">
            <h2>&gt;&gt; REALTIME DIFF BATTLE</h2>
            <span className="recording-pill">REC_SESSION_#0x9v2</span>
          </div>
          <p className="section-sub">Objective: Transform buffer A to buffer B</p>

          <div className="mock-editors">
            <article>
              <header>LOCAL [YOU]</header>
              <pre>{localPreview.join('\n')}</pre>
            </article>
            <article>
              <header>REMOTE [OPP]</header>
              <pre>{remotePreview.join('\n')}</pre>
            </article>
          </div>
        </section>

        <section className="content-panel">
          <div className="section-head">
            <h2>TOP PROCESS LIST</h2>
          </div>
          <div className="terminal-table-wrap">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>PID</th>
                  <th>USER</th>
                  <th>%CPU</th>
                  <th>%MEM</th>
                  <th>TIME+</th>
                  <th>COMMAND</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>vim_god</td>
                  <td>100.0</td>
                  <td>12.3</td>
                  <td>99:99.99</td>
                  <td>/usr/bin/vim --winner</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>:q!</td>
                  <td>84.2</td>
                  <td>8.1</td>
                  <td>42:10.05</td>
                  <td>/bin/sh -c quit.fvce</td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>hjk_nero</td>
                  <td>79.5</td>
                  <td>6.4</td>
                  <td>12:34.56</td>
                  <td>./move_cursor.py</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="feature-grid">
          <article>
            <p className="feature-kicker">FLAG-SPEED</p>
            <h3>&gt; Blazing Fast</h3>
            <p>
              Optimized for low latency. Every keystroke is registered and broadcasted in milliseconds.
            </p>
          </article>
          <article>
            <p className="feature-kicker">FLAG-EDUCATION</p>
            <h3>&gt; Learn While Playing</h3>
            <p>Master complex regex patterns and obscure Vim motions while climbing.</p>
          </article>
          <article>
            <p className="feature-kicker">FLAG-RANKED</p>
            <h3>&gt; Ranked Seasons</h3>
            <p>Climb from Normal Mode Novice to Visual Block Virtuoso and unlock configs.</p>
          </article>
        </section>

        <footer className="terminal-footer">
          <p className="footer-cmd">root@vim-royale:/footer# ls -la</p>
          <div>
            <p>./GAME/</p>
            <p>- play_now</p>
            <p>- practice</p>
            <p>- leaderboards</p>
          </div>
          <div>
            <p>./COMMUNITY/</p>
            <p>- discord</p>
            <p>- github</p>
            <p>- x_twitter</p>
          </div>
        </footer>
      </main>
    </div>
  )
}
