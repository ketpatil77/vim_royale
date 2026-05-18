import { useNavigate } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../../contexts/CRTContext'
import { useTimedGame } from '../../contexts/TimedGameContext'
import type { Difficulty } from '../../utils/challenges'
import './DifficultySelect.css'

const difficulties: { id: Difficulty; label: string; description: string; color: string }[] = [
  { id: 'beginner', label: 'BEGINNER', description: '1 mutation per line, hints shown', color: 'var(--green)' },
  { id: 'intermediate', label: 'INTERMEDIATE', description: '2 mutations per line, motion hints only', color: 'var(--yellow)' },
  { id: 'advanced', label: 'ADVANCED', description: '3 mutations per line, no hints', color: '#ff8c00' },
  { id: 'expert', label: 'EXPERT', description: '4 mutations per line, no hints, full chaos', color: 'var(--red)' },
]

export default function DifficultySelect() {
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()
  const { startGame, getBestScore } = useTimedGame()

  const handleSelect = (difficulty: Difficulty) => {
    startGame(difficulty)
    navigate('/match/timed')
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="difficulty-select-container">
        <h1 className="difficulty-title">&gt;&gt; SELECT DIFFICULTY</h1>
        <div className="difficulty-grid">
          {difficulties.map(d => {
            const best = getBestScore(d.id)
            return (
              <button
                key={d.id}
                className="difficulty-btn"
                style={{ '--difficulty-color': d.color } as React.CSSProperties}
                onClick={() => handleSelect(d.id)}
              >
                <span className="difficulty-label">{d.label}</span>
                <span className="difficulty-desc">{d.description}</span>
                {best && (
                  <span className="difficulty-best">Best: {formatTime(best.time)}</span>
                )}
              </button>
            )
          })}
        </div>
        <button className="back-btn" onClick={() => navigate('/play')}>
          ./BACK.sh
        </button>
      </div>
    </TerminalLayout>
  )
}