import { useEffect } from 'react'
import './MatchResultModal.css'

interface MatchResultModalProps {
  isOpen: boolean
  title: string
  description: string
  onMainMenu: () => void
  onNewMatch: () => void
}

export default function MatchResultModal({
  isOpen,
  title,
  description,
  onMainMenu,
  onNewMatch,
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

  return (
    <div className="result-modal-overlay">
      <div className="result-modal">
        <div className="result-modal-header">
          <span className="result-modal-filename">:match_result.sh</span>
        </div>

        <div className="result-modal-body">
          <h2 className={`result-modal-title ${title === 'VICTORY!' ? 'victory' : 'defeat'}`}>
            {title}
          </h2>
          <p className="result-modal-description">{description}</p>
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

export function parseResult(resultText: string): { title: string; description: string, matchWinner: string } {
  const matchWinner = resultText.split('. ')[0];
  const [outcome, ...rest] = resultText.split('. ')
  const description = rest.join('. ')

  if (outcome === 'You won') {
    return { title: 'VICTORY!', description, matchWinner }
  } else {
    return { title: 'DEFEAT', description, matchWinner }
  }
}