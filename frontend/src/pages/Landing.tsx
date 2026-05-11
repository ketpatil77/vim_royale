import { useNavigate } from 'react-router-dom'
import VimRoyaleDuel from '../components/HeroEditors'
import { TerminalLayout } from '../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../contexts/CRTContext'
import './Landing.css'

export default function Landing() {
  const { crtEnabled, toggleCrt } = useCRT()
  const navigate = useNavigate()

  return (
    <TerminalLayout
      crtEnabled={crtEnabled}
      onCrtToggle={toggleCrt}
    >
      <main className="vr-main">

        <section className="vr-hero">
          <pre className="vr-ascii" aria-label="VIM ROYALE">{[
            '██╗   ██╗██╗███╗   ███╗    ██████╗  ██████╗ ██╗   ██╗ █████╗ ██╗     ███████╗',
            '██║   ██║██║████╗ ████║    ██╔══██╗██╔═══██╗╚██╗ ██╔╝██╔══██╗██║     ██╔════╝',
            '██║   ██║██║██╔████╔██║    ██████╔╝██║   ██║ ╚████╔╝ ███████║██║     █████╗  ',
            '╚██╗ ██╔╝██║██║╚██╔╝██║    ██╔══██╗██║   ██║  ╚██╔╝  ██╔══██║██║     ██╔══╝  ',
            ' ╚████╔╝ ██║██║ ╚═╝ ██║    ██║  ██║╚██████╔╝   ██║   ██║  ██║███████╗███████╗',
            '  ╚═══╝  ╚═╝╚═╝     ╚═╝    ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝',
          ].join('\n')}</pre>

          <p className="vr-tagline">&gt; one shall lose, one shall vim</p>

          <div className="vr-ctas">
            <button className="vr-cta" onClick={() => navigate('/play')}>
              [&nbsp;&nbsp;PLAY NOW&nbsp;&nbsp;]
            </button>
            <button className="vr-cta vr-cta--dim">
              [&nbsp;&nbsp;HOW TO PLAY&nbsp;&nbsp;]
            </button>
          </div>

          <VimRoyaleDuel/>
        </section>

        {/* <footer className="vr-footer">
          <nav className="vr-footer-links">
            <span onClick={() => navigate('/leaderboard')}>Leaderboard</span>
            <span className="vr-footer-sep">·</span>
            <span>GitHub</span>
            <span className="vr-footer-sep">·</span>
            <span>Docs</span>
          </nav>
        </footer> */}

      </main>
    </TerminalLayout>
  )
}