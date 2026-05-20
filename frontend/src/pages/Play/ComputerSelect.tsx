import { useNavigate } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../../contexts/CRTContext'
import './ComputerSelect.css'

const BOTS = [
  {
    id: 'pixelfox',
    name: 'PixelFox',
    difficulty: 'Easy',
    rating: 800,
    avatar: 'https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_2.png',
  },
  {
    id: 'cyberbadger',
    name: 'CyberBadger',
    difficulty: 'Medium',
    rating: 1200,
    avatar: 'https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_3.png',
  },
  {
    id: 'neontiger',
    name: 'NeonTiger',
    difficulty: 'Hard',
    rating: 1600,
    avatar: 'https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_4.png',
  },
  {
    id: 'quantumraven',
    name: 'QuantumRaven',
    difficulty: 'Expert',
    rating: 2000,
    avatar: 'https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_5.png',
  },
]

export default function ComputerSelect() {
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="computer-select-container">
        <h1 className="computer-title">&gt;&gt; SELECT BOT OPPONENT</h1>

        <div className="bot-grid">
          {BOTS.map((bot) => (
            <button
              key={bot.id}
              className="bot-card"
              onClick={() => navigate(`/match/computer?botId=${bot.id}`)}
            >
              <img src={bot.avatar} alt={bot.name} className="bot-avatar" />
              <span className="bot-name">{bot.name}</span>
              <span className="bot-difficulty">{bot.difficulty}</span>
              <span className="bot-rating">Rating {bot.rating}</span>
            </button>
          ))}
        </div>

        <button className="bot-back-btn" onClick={() => navigate('/play')}>
          ./BACK.sh
        </button>
      </div>
    </TerminalLayout>
  )
}
