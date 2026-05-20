import { useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AnimatedBackgrounds/AuroraBackground'
import VimRoyaleDuel from '../components/HeroEditors'
import { TerminalLayout } from '../components/TerminalLayout/TerminalLayout'
import { VimRoyaleHero } from '../components/VimRoyaleHero/VimRoyaleHero'
import { VT100TitleBar } from '../components/VT100TitleBar/VT100TitleBar'
import { useCRT } from '../contexts/CRTContext'
import './Landing.css'

const GAME_MODES = [
  { cmd: ':vs',       title: '1V1',           desc: '2 Players, Split Screen' },
  { cmd: ':timer',    title: 'Single Player', desc: 'Timed challenges against yourself' },
  { cmd: ':top',      title: 'Leaderboard',   desc: 'Compete for the top spot' },
  { cmd: ':vimtutor', title: 'VimTutor',      desc: 'Learn vim the way it was meant to be' },
]

const HOW_TO_PLAY_STEPS = [
  {
    step: '01',
    cmd: ':load',
    title: 'load a broken challenge',
    desc: 'A real algorithm opens in your editor, already corrupted with misplaced tokens, bad indentation, and sneaky logic errors.',
    tag: 'INPUT',
  },
  {
    step: '02',
    cmd: ':fix',
    title: 'repair it with vim',
    desc: 'Move fast with motions, operators, macros, and substitutions. No mouse. No arrow-key comfort. Just your command of the buffer.',
    tag: 'EDIT',
  },
  {
    step: '03',
    cmd: ':w',
    title: 'save when it passes',
    desc: 'Run the tests by writing the file. The first correct buffer wins the round, so every clean edit matters.',
    tag: 'WIN',
  },
  {
    step: '04',
    cmd: ':rank',
    title: 'climb by being precise',
    desc: 'Wins raise your rating, but speed and accuracy decide how far you climb. Cleaner fixes, sharper rank.',
    tag: 'RANK',
  },
]

const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'a real vim engine in the browser',
    desc: 'no stripped-down emulation. actual motions, operators, and modes.',
  },
  {
    num: '02',
    title: 'full normal / insert / visual / command-line modes',
    desc: 'gg, G, %, ci", ya{, and everything in between',
  },
  {
    num: '03',
    title: 'live opponent preview',
    desc: 'watch their cursor move in real time as you race',
  },
  {
    num: '04',
    title: 'elo-ranked matchmaking',
    desc: 'climb the leaderboard as your vim improves',
  },
]

export default function Landing() {
  const { crtEnabled, toggleCrt } = useCRT()
  const navigate = useNavigate()

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <main className="vr-main">
        <AuroraBackground/>

        {/* ── Hero ── */}
        <section className="vr-hero">
          <VimRoyaleHero />
          <p className="vr-tagline">&gt; one shall lose, one shall vim</p>
          <div className="vr-ctas">
            <button className="vr-cta" onClick={() => navigate('/play')}>
              [&nbsp;&nbsp;PLAY NOW&nbsp;&nbsp;]
            </button>
            <button className="vr-cta vr-cta--dim" onClick={() => navigate('/docs/vimtutor')}>
              [&nbsp;&nbsp;LEARN VIM&nbsp;&nbsp;]
            </button>
          </div>
          <VimRoyaleDuel />
        </section>

        {/* ── Game Modes ── */}
        <section className="features">
          <p className="vr-section-label">choose your battle</p>
          <h1 className="vr-h1">Different Game Modes</h1>
          <div className="vr-features">
            {GAME_MODES.map(({ cmd, title, desc }) => (
              <div className="vr-feature" key={title}>
                <p className="vr-feature-cmd">{cmd}</p>
                <h2 className="vr-h2">{title}</h2>
                <p className="vr-p">{desc}</p>
              </div>
            ))}
          </div>


          {/* ── How to Play ── */}
          <p className="vr-section-label">the loop</p>
          <h2 className="vr-h1">How to Play</h2>

          <div className="htp-grid">
            {HOW_TO_PLAY_STEPS.map(({ step, cmd, title, desc, tag }) => (
              <div className="htp-card" key={step}>
                <div className="htp-card-topbar">
                  <span className="htp-card-step">{step}</span>
                  <span className="htp-card-cmd">{cmd}</span>
                  <span className="htp-card-tag">{tag}</span>
                </div>
                <h3 className="htp-card-title">{title}</h3>
                <p className="htp-card-desc">{desc}</p>
                <span className="htp-card-watermark" aria-hidden="true">{step}</span>
              </div>
            ))}
          </div>



          {/* ── How It Works ── */}
          <h2 className="how-it-works-header">:how-it-works</h2>
          <div className="how-it-works-grid">
            {HOW_IT_WORKS.map(({ num, title, desc }) => (
              <div className="feature-box" key={num}>
                <VT100TitleBar num={num} />
                <p className="feature-box-title">{title}</p>
                <p className="feature-box-desc">{desc}</p>
                <span className="feature-box-watermark" aria-hidden="true">{num}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </TerminalLayout>
  )
}