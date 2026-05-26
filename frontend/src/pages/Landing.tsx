import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AnimatedBackgrounds/AuroraBackground'
import { AerialUpdateBanner } from '../components/AerialUpdateBanner/AerialUpdateBanner'
import VimRoyaleDuel from '../components/HeroEditors'
import { TerminalLayout } from '../components/TerminalLayout/TerminalLayout'
import { VimRoyaleHero } from '../components/VimRoyaleHero/VimRoyaleHero'
import { VT100TitleBar } from '../components/VT100TitleBar/VT100TitleBar'
import { useCRT } from '../contexts/CRTContext'
import './Landing.css'
import '../components/AerialUpdateBanner/AerialUpdateBanner.css'

const RELEASE_BANNER_MESSAGE = 'v0.2.0: Spectator mode, improved matchmaking, Create custom tournaments and play with your friends!'

const GAME_MODES = [
  { cmd: ':vs',       title: '1V1',           desc: '2 Players, Split Screen' },
  { cmd: ':timer',    title: 'Single Player', desc: 'Timed challenges against yourself' },
  { cmd: ':ai',      title: 'Play with Bot',   desc: 'Compete against AI bot' },
  { cmd: ':tournament', title: 'Tournaments', desc: 'Create private lobbies to compete against your friends!' },
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
    cmd: ':check',
    title: 'match the target code',
    desc: 'The game watches your buffer as you edit. The moment it matches the clean solution, the round ends automatically.',
    tag: 'DONE',
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
    title: 'live opponent preview',
    desc: 'watch their cursor move in real time as you race',
  },
  {
    num: '03',
    title: 'elo-ranked matchmaking',
    desc: 'climb the leaderboard as your vim improves',
  },
  {
    num: '04',
    title: 'replay your moves',
    desc: 're-watch your wins in all their glory post match and learn from your mistakes',
  },
]

const FEEDBACK_ENDPOINT = 'https://usepostbox.com/api/MTZjY2Q4NDgtYTAxMS00ZjE5LWE1YmYtNzAxNmJhNWIzODI1XzE/f/feedback-form'

type FeedbackErrors = Record<string, string[]>
type FeedbackStatus = 'idle' | 'submitting' | 'success' | 'error'

function GithubIcon() {
  return (
    <svg className="vr-social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56v-2.18c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.73-1.53-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18.92-.26 1.9-.38 2.88-.39.98.01 1.96.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.09 0 4.43-2.7 5.41-5.27 5.7.41.36.78 1.06.78 2.14v3.18c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="vr-social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.9 2h3.37l-7.36 8.41L23.56 22h-6.77l-5.3-6.93L5.42 22H2.05l7.87-9L1.63 2h6.94l4.79 6.33L18.9 2Zm-1.18 17.96h1.87L7.55 3.93h-2L17.72 19.96Z"
      />
    </svg>
  )
}

export default function Landing() {
  const { crtEnabled, toggleCrt } = useCRT()
  const navigate = useNavigate()
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle')
  const [feedbackErrors, setFeedbackErrors] = useState<FeedbackErrors | null>(null)

  const handleFeedbackSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    setFeedbackStatus('submitting')
    setFeedbackErrors(null)

    const formData = new FormData(form)
    const feedbackPayload = {
      Feedback: String(formData.get('Feedback') || ''),
      'How to Reproduce the Bug': String(formData.get('How to Reproduce the Bug') || ''),
    }

    try {
      const response = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackPayload),
      })

      if (response.ok) {
        form.reset()
        setFeedbackStatus('success')
        return
      }

      const body = await response.json().catch(() => null)
      setFeedbackErrors(body?.error?.details || { _form: [body?.error?.message || 'Something went wrong.'] })
      setFeedbackStatus('error')
    } catch {
      setFeedbackErrors({ _form: ['Network error. Please try again.'] })
      setFeedbackStatus('error')
    }
  }

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <main className="vr-main">
        <AuroraBackground/>

        {/* ── Hero ── */}
        <section className="vr-hero">
          <AerialUpdateBanner
            label="release"
            message={RELEASE_BANNER_MESSAGE}
          />
          <VimRoyaleHero />
          <p className="vr-tagline">&gt; one shall lose, one shall vim</p>
          <div className="vr-ctas">
            <button className="vr-cta" onClick={() => navigate('/play')}>
              [&nbsp;&nbsp;PLAY NOW&nbsp;&nbsp;]
            </button>
            <button className="vr-cta vr-cta--dim" onClick={() => navigate('/play/tournament/create')}>
              [&nbsp;&nbsp;CREATE TOURNAMENT&nbsp;&nbsp;]
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

        <footer className="vr-footer">
          <form className="vr-feedback-form" onSubmit={handleFeedbackSubmit}>
            <div className="vr-feedback-head">
              <span className="vr-feedback-title">:feedback</span>
              <span className="vr-feedback-status">
                {feedbackStatus === 'success' ? 'sent' : feedbackStatus === 'submitting' ? 'sending' : 'open'}
              </span>
            </div>
            <div className="vr-feedback-fields">
              <label className="vr-feedback-field">
                <span>Feedback *</span>
                <textarea name="Feedback" required rows={4} placeholder="bug report, idea, rough edge..." />
              </label>
              <label className="vr-feedback-field">
                <span>How to Reproduce the Bug</span>
                <textarea name="How to Reproduce the Bug" rows={4} placeholder="steps, browser, match mode..." />
              </label>
            </div>
            {feedbackErrors && (
              <div className="vr-feedback-message vr-feedback-message--error">
                {Object.entries(feedbackErrors).map(([field, messages]) => (
                  <p key={field}>{field}: {messages.join(', ')}</p>
                ))}
              </div>
            )}
            {feedbackStatus === 'success' && (
              <p className="vr-feedback-message vr-feedback-message--success">feedback received. thank you.</p>
            )}
            <button className="vr-feedback-submit" type="submit" disabled={feedbackStatus === 'submitting'}>
              {feedbackStatus === 'submitting' ? 'SENDING...' : 'SEND FEEDBACK'}
            </button>
          </form>

          <div className="vr-footer-links">
            <span>built with &lt;3 by</span>
            <a className="vr-social-link" href="https://github.com/Jitesh117" target="_blank" rel="noreferrer" aria-label="Jitesh on GitHub">
              <GithubIcon />
              Jitesh
            </a>
            <span className="vr-footer-sep">/</span>
            <a className="vr-social-link" href="https://x.com/vim_royale" target="_blank" rel="noreferrer" aria-label="vim_royale on X">
              <XIcon />
              @vim_royale
            </a>
            <span className="vr-footer-sep">/</span>
            <a
              className="vr-sponsor-link"
              href="https://github.com/sponsors/Jitesh117"
              target="_blank"
              rel="noreferrer"
              aria-label="Sponsor Jitesh117"
            >
              <svg className="vr-sponsor-icon" viewBox="0 0 24 24" height="14" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              Sponsor
            </a>
          </div>
        </footer>
      </main>
    </TerminalLayout>
  )
}
