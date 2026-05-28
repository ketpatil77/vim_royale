import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../../contexts/CRTContext'
import './MiniGames.css'

type MiniGameChoice = {
  id: 'breakout' | 'snake'
  label: string
  description: string
  hotkey: '1' | '2'
  color: string
}

const MINI_GAMES: MiniGameChoice[] = [
  {
    id: 'breakout',
    label: 'ATARI BREAKOUT',
    description: 'Break bricks, keep the ball alive, and chase a high score.',
    hotkey: '1',
    color: '#ffb000',
  },
  {
    id: 'snake',
    label: 'VIM SNAKE',
    description: 'Navigate with hjkl, grow your trail, avoid self-collision.',
    hotkey: '2',
    color: 'var(--green)',
  },
]

export default function MiniGames() {
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) return

      if (event.key === '1') {
        event.preventDefault()
        navigate('/play/minigames/breakout')
      }

      if (event.key === '2') {
        event.preventDefault()
        navigate('/play/minigames/snake')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="mini-games-shell">
        <div className="mini-games-content">
          <h1 className="mini-games-title">&gt;&gt; MINI GAMES ARCADE</h1>
          <p className="mini-games-subtitle">
            Choose a mini game. Tip: press keys `1-2` for quick launch.
          </p>

          <div className="mini-games-grid" role="list" aria-label="Mini game choices">
            {MINI_GAMES.map((game) => (
              <button
                key={game.id}
                type="button"
                role="listitem"
                className="mini-game-tile"
                style={{ '--mini-game-color': game.color } as React.CSSProperties}
                onClick={() => navigate(`/play/minigames/${game.id}`)}
              >
                <div className="mini-game-tile-top">
                  <span className="mini-game-tile-label">{game.label}</span>
                  <span className="mini-game-tile-hotkey">[{game.hotkey}]</span>
                </div>
                <span className="mini-game-tile-desc">{game.description}</span>
              </button>
            ))}
          </div>

          <div className="mini-games-actions">
            <button type="button" className="mini-games-back-btn" onClick={() => navigate('/play')}>
              BACK TO MODES
            </button>
          </div>
        </div>
      </div>
    </TerminalLayout>
  )
}
