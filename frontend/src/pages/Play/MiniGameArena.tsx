import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { AtariBreakout } from '../../components/MiniGames/AtariBreakout'
import { VimSnake } from '../../components/MiniGames/VimSnake'
import { useCRT } from '../../contexts/CRTContext'
import './MiniGameArena.css'

export default function MiniGameArena() {
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()
  const { gameId } = useParams<{ gameId: string }>()

  const selected = useMemo(() => {
    if (gameId === 'breakout') {
      return {
        title: 'ATARI BREAKOUT',
        hint: 'move with h/l or arrows',
        content: <AtariBreakout />,
      }
    }

    if (gameId === 'snake') {
      return {
        title: 'VIM SNAKE',
        hint: 'move with h/j/k/l or arrows',
        content: <VimSnake />,
      }
    }

    return null
  }, [gameId])

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="mini-game-arena-shell">
        <div className="mini-game-arena-content">
          <h1 className="mini-game-arena-title">&gt;&gt; MINI GAME</h1>
          {selected ? (
            <>
              <p className="mini-game-arena-subtitle">
                {selected.title} · {selected.hint}
              </p>
              {selected.content}
            </>
          ) : (
            <div className="mini-game-invalid">Unknown mini game selection.</div>
          )}

          <div className="mini-game-arena-actions">
            <button type="button" className="mini-game-arena-back-btn" onClick={() => navigate('/play/minigames')}>
              CHOOSE ANOTHER GAME
            </button>
            <button type="button" className="mini-game-arena-back-btn" onClick={() => navigate('/play')}>
              BACK TO MODES
            </button>
          </div>
        </div>
      </div>
    </TerminalLayout>
  )
}
