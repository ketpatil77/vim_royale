import { useNavigate } from 'react-router-dom'
import VimRoyaleDuel from '../components/HeroEditors'
import { TerminalLayout } from '../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../contexts/CRTContext'
import './Landing.css'
import { VimRoyaleHero } from '../components/VimRoyaleHero/VimRoyaleHero'

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
          <VimRoyaleHero/>
          <p className="vr-tagline">&gt; one shall lose, one shall vim</p>
          <div className="vr-ctas">
            <button className="vr-cta" onClick={() => navigate('/play')}>
              [&nbsp;&nbsp;PLAY NOW&nbsp;&nbsp;]
            </button>
            <button className="vr-cta vr-cta--dim" onClick={() => navigate('/docs/vimtutor')}>
              [&nbsp;&nbsp;LEARN VIM&nbsp;&nbsp;]
            </button>
          </div>
          <VimRoyaleDuel/>
        </section>
      </main>
    </TerminalLayout>
  )
}