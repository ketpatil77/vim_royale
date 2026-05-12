import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import VimRoyaleDuel from '../components/HeroEditors'
import { TerminalLayout } from '../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../contexts/CRTContext'
import './Landing.css'

export default function Landing() {
  const { crtEnabled, toggleCrt } = useCRT()
  const navigate = useNavigate()
  const [showLore, setShowLore] = useState(false)

  return (
    <TerminalLayout
      crtEnabled={crtEnabled}
      onCrtToggle={toggleCrt}
    >
      {showLore && <LoreCrawl onDismiss={() => setShowLore(false)} />}
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
            <button className="vr-cta vr-cta--dim" onClick={() => setShowLore(true)}>
              [&nbsp;&nbsp;HOW TO PLAY&nbsp;&nbsp;]
            </button>
          </div>
          <VimRoyaleDuel/>
        </section>
      </main>
    </TerminalLayout>
  )
}