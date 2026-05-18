import { useNavigate } from "react-router-dom";
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout';
import { useCRT } from '../../contexts/CRTContext';
import './Play.css';

export default function Play() {
  const { crtEnabled, toggleCrt } = useCRT()
  const navigate = useNavigate();

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
    <div className="game-shell">
      <div className="play-select-container">
        <h1 className="play-title">&gt;&gt; SELECT GAME MODE</h1>
        <div className="play-modes">
          <button
            className="play-mode-btn"
            onClick={() => navigate('/match/multiplayer')}
          >
            <span className="play-mode-label">MULTIPLAYER</span>
            <span className="play-mode-desc">Challenge other players in real-time</span>
          </button>
          <button
            className="play-mode-btn play-mode-btn--dim"
            disabled
          >
            <span className="play-mode-label">SINGLE PLAYER</span>
            <span className="play-mode-desc">Practice your vim skills (coming soon)</span>
          </button>
        </div>
      </div>
    </div>
    </TerminalLayout>
  )
}