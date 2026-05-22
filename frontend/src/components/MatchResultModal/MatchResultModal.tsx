import { useEffect } from 'react'
import type { GameOverPayload } from '../../pages/typingChallenge/types'
import './MatchResultModal.css'

interface MatchResultModalProps {
  isOpen: boolean
  title: string
  description: string
  onMainMenu: () => void
  onNewMatch: () => void
  gameOverPayload: GameOverPayload
}

export default function MatchResultModal({
  isOpen,
  title,
  description,
  onMainMenu,
  onNewMatch,
  gameOverPayload,
}: MatchResultModalProps) {

  useEffect(() => {
    if (!isOpen) return

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === '1') onMainMenu()
      if (e.key === '2') onNewMatch()
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [isOpen, onMainMenu, onNewMatch])

  if (!isOpen) return null

  const isDraw = gameOverPayload.resultType === 'draw'
  const { winnerName, winnerAvatar, winnerNewRating, winnerDelta, loserName, loserAvatar, loserNewRating, loserDelta } = gameOverPayload

  return (
    <div className="result-modal-overlay">
      <div className="result-modal">
        <div className="result-modal-header">
          <span className="result-modal-filename">:match_result.sh</span>
        </div>

        <div className="result-modal-body">
          <h2 className={`result-modal-title ${title === 'VICTORY!' ? 'victory' : title === 'DRAW' ? 'draw' : 'defeat'}`}>
            {title}
          </h2>
          <p className="result-modal-description">{description}</p>

          <div className="result-modal-players">
            <div className={`player-card ${isDraw ? 'player-card--draw' : 'player-card--winner'}`}>
              <img
                src={winnerAvatar || `https://github.com/identicons/github.png`}
                alt={winnerName}
                className="player-card-avatar"
              />
              <span className="player-card-name">{winnerName}</span>
              <div className="player-card-rating">
                <span className="player-card-rating-new">{Math.round(winnerNewRating)}</span>
                <span className={`player-card-rating-delta ${winnerDelta >= 0 ? 'positive' : 'negative'}`}>
                  ({winnerDelta >= 0 ? '+' : ''}{winnerDelta.toFixed(0)})
                </span>
              </div>
            </div>

            <div className={`player-card ${isDraw ? 'player-card--draw' : 'player-card--loser'}`}>
              <img
                src={loserAvatar || `https://github.com/identicons/github.png`}
                alt={loserName}
                className="player-card-avatar"
              />
              <span className="player-card-name">{loserName}</span>
              <div className="player-card-rating">
                <span className="player-card-rating-new">{Math.round(loserNewRating)}</span>
                <span className={`player-card-rating-delta ${loserDelta >= 0 ? 'positive' : 'negative'}`}>
                  ({loserDelta >= 0 ? '+' : ''}{loserDelta.toFixed(0)})
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="result-modal-footer">
          <button className="result-modal-btn" onClick={onMainMenu}>
            <span className="result-modal-key">[:1]</span>
            <span className="result-modal-label">Main Menu</span>
          </button>
          <button className="result-modal-btn primary" onClick={onNewMatch}>
            <span className="result-modal-key">[:2]</span>
            <span className="result-modal-label-new">New Match</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function parseResult(resultText: string, gameOverPayload: GameOverPayload): { title: string; description: string; gameOverPayload: GameOverPayload } {
  if (gameOverPayload.resultType === 'draw') {
    return { title: 'DRAW', description: 'Time limit reached. Ratings unchanged.', gameOverPayload }
  }

  const [outcome, ...rest] = resultText.split('. ')
  const description = rest.join('. ')

  if (outcome === 'You won') {
    return { title: 'VICTORY!', description, gameOverPayload }
  } else {
    return { title: 'DEFEAT', description, gameOverPayload }
  }
}
