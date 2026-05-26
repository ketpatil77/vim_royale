import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../../contexts/CRTContext'
import type { TournamentFormat } from '../../types/tournament'
import { createTournament } from '../../utils/tournamentApi'
import './Tournament.css'

type TournamentModeOption = {
  format: TournamentFormat
  label: string
  subtitle: string
}

const TOURNAMENT_MODES: TournamentModeOption[] = [
  {
    format: 'single_elimination',
    label: 'Quick Cup',
    subtitle: 'Fastest mode. One loss and out.',
  },
  {
    format: 'double_elimination',
    label: 'Second Chance',
    subtitle: 'Two losses to eliminate. Fair and competitive.',
  },
  {
    format: 'group_knockout',
    label: 'Championship',
    subtitle: 'Group stage first, then playoffs.',
  },
]

export default function TournamentCreate() {
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()
  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [format, setFormat] = useState<TournamentFormat>('single_elimination')
  const [grandFinalReset, setGrandFinalReset] = useState(true)
  const [groupSize, setGroupSize] = useState(4)
  const [advancePerGroup, setAdvancePerGroup] = useState(2)
  const [inviteLink, setInviteLink] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [joinError, setJoinError] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Tournament name is required')
      return
    }
    if (format === 'group_knockout' && advancePerGroup >= groupSize) {
      setError('Teams advancing per group must be less than group size')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const settings =
        format === 'double_elimination'
          ? { grandFinalReset }
          : format === 'group_knockout'
            ? { groupSize, advancePerGroup }
            : undefined

      const created = await createTournament({
        name: name.trim(),
        maxPlayers,
        format,
        settings,
      })
      navigate(`/t/${created.tournament.slug}?invite=${encodeURIComponent(created.inviteToken)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoinByLink = (e: React.FormEvent) => {
    e.preventDefault()
    setJoinError('')

    const raw = inviteLink.trim()
    if (!raw) {
      setJoinError('Invite link is required')
      return
    }

    try {
      // Accept both full URLs and /t/... relative paths.
      const parsed = raw.startsWith('http://') || raw.startsWith('https://')
        ? new URL(raw)
        : new URL(raw, window.location.origin)

      const segments = parsed.pathname.split('/').filter(Boolean)
      if (segments.length < 2 || segments[0] !== 't' || !segments[1]) {
        setJoinError('Invalid invite link format')
        return
      }

      const slug = segments[1]
      const invite = parsed.searchParams.get('invite')

      const params = new URLSearchParams()
      if (invite) params.set('invite', invite)
      const query = params.toString()

      navigate(`/t/${slug}${query ? `?${query}` : ''}`)
    } catch {
      setJoinError('Invalid invite link')
    }
  }

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <div className="tournament-shell">
        <div className="tournament-card">
          <h1 className="tournament-title">&gt;&gt; CREATE PRIVATE TOURNAMENT</h1>
          <form className="tournament-form" onSubmit={handleCreate}>
            <label className="tournament-label" htmlFor="t-name">Tournament Name</label>
            <input
              id="t-name"
              className="tournament-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday Vim Cup"
              maxLength={64}
              required
            />

            <label className="tournament-label" htmlFor="t-size">Max Players</label>
            <select
              id="t-size"
              className="tournament-input"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            >
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
            </select>

            <div>
              <p className="tournament-label">Tournament Style</p>
              <div className="tournament-mode-grid">
                {TOURNAMENT_MODES.map((mode) => (
                  <button
                    key={mode.format}
                    type="button"
                    className={`tournament-mode-card ${format === mode.format ? 'selected' : ''}`}
                    onClick={() => setFormat(mode.format)}
                    aria-pressed={format === mode.format}
                  >
                    <span className="tournament-mode-label">{mode.label}</span>
                    <span className="tournament-mode-subtitle">{mode.subtitle}</span>
                  </button>
                ))}
              </div>
            </div>

            {format === 'double_elimination' && (
              <div className="tournament-settings-grid">
                <label className="tournament-toggle">
                  <input
                    type="checkbox"
                    checked={grandFinalReset}
                    onChange={(e) => setGrandFinalReset(e.target.checked)}
                  />
                  Enable grand final reset
                </label>
              </div>
            )}

            {format === 'group_knockout' && (
              <div className="tournament-settings-grid">
                <label className="tournament-label" htmlFor="groupSize">Group Size</label>
                <select
                  id="groupSize"
                  className="tournament-input"
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                >
                  <option value={4}>4</option>
                  <option value={8}>8</option>
                </select>

                <label className="tournament-label" htmlFor="advancePerGroup">Advance Per Group</label>
                <select
                  id="advancePerGroup"
                  className="tournament-input"
                  value={advancePerGroup}
                  onChange={(e) => setAdvancePerGroup(Number(e.target.value))}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
            )}

            {error && <p className="tournament-error">{error}</p>}

            <div className="tournament-row">
              <button className="tournament-btn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'CREATING...' : 'CREATE'}
              </button>
              <button className="tournament-btn tournament-btn--ghost" type="button" onClick={() => navigate('/play')}>
                BACK
              </button>
            </div>
          </form>

          <div className="tournament-divider" />

          <h2 className="tournament-subtitle">Join via Invite Link</h2>
          <form className="tournament-form" onSubmit={handleJoinByLink}>
            <label className="tournament-label" htmlFor="invite-link">Invite Link</label>
            <input
              id="invite-link"
              className="tournament-input"
              value={inviteLink}
              onChange={(e) => setInviteLink(e.target.value)}
              placeholder="https://.../t/<slug>?invite=<token>"
              required
            />

            {joinError && <p className="tournament-error">{joinError}</p>}

            <div className="tournament-row">
              <button className="tournament-btn tournament-btn--ghost" type="submit">
                JOIN TOURNAMENT
              </button>
            </div>
          </form>
        </div>
      </div>
    </TerminalLayout>
  )
}
