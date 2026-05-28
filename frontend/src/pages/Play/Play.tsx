import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../../contexts/CRTContext'
import './Play.css'

type GameMode = {
  id: string
  title: string
  description: string
  hotkey: string
  eta: string
  audience: string
  route?: string
  isComingSoon?: boolean
}

const GAME_MODES: GameMode[] = [
  {
    id: 'multiplayer',
    title: 'Multiplayer',
    description: 'Challenge other players in real-time.',
    hotkey: '1',
    eta: '~2-3 min',
    audience: 'Best for: Competitive matches',
    route: '/match/multiplayer',
  },
  {
    id: 'single-player',
    title: 'Single Player',
    description: 'Practice your Vim skills with a 120s timer.',
    hotkey: '2',
    eta: '~2 min',
    audience: 'Best for: Focused practice',
    route: '/play/difficulty',
  },
  {
    id: 'computer',
    title: 'Play vs Computer',
    description: 'Race AI bots across four skill tiers.',
    hotkey: '3',
    eta: '~2-3 min',
    audience: 'Best for: Solo challenge',
    route: '/play/computer',
  },
  {
    id: 'tournament',
    title: 'Private Tournament',
    description: 'Create and share invite-only event lobbies.',
    hotkey: '4',
    eta: '~10+ min',
    audience: 'Best for: Group sessions',
    route: '/play/tournament/create',
  },
  {
    id: 'mini-games',
    title: 'Mini Games',
    description: 'Play Atari Breakout and Vim Snake now!',
    hotkey: '5',
    eta: 'Live now',
    audience: 'Best for: Quick warmups',
    route: '/play/minigames',
  },
]

export default function Play() {
  const { crtEnabled, toggleCrt } = useCRT()
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) return

      const selected = GAME_MODES.find((mode) => mode.hotkey === event.key)
      if (!selected?.route) return

      event.preventDefault()
      navigate(selected.route)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="game-shell">
        <div className="play-select-container">
          <h1 className="play-title">&gt;&gt; SELECT GAME MODE</h1>
          <p className="play-subtitle">Choose your next run. Tip: press keys `1-5` for quick launch.</p>

          <div className="play-modes" role="list" aria-label="Game mode options">
            {GAME_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="listitem"
                className={`play-mode-btn ${mode.isComingSoon ? 'play-mode-btn--dim' : ''}`}
                onClick={() => mode.route && navigate(mode.route)}
                disabled={!mode.route}
                aria-disabled={!mode.route}
              >
                <div className="play-mode-content">
                  <div className="play-mode-top">
                    <span className="play-mode-label">{mode.title.toUpperCase()}</span>
                    <span className="play-mode-hotkey">[{mode.hotkey}]</span>
                  </div>
                  <span className="play-mode-desc">{mode.description}</span>
                  <div className="play-mode-meta">
                    <span>{mode.audience}</span>
                    <span>{mode.eta}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="play-actions">
            <button type="button" className="play-back-btn" onClick={() => navigate('/')}>
              BACK TO HOME
            </button>
          </div>
        </div>
      </div>
    </TerminalLayout>
  )
}
