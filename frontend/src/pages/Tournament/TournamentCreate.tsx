import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TerminalLayout } from '../../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../../contexts/CRTContext'
import { createTournament } from '../../utils/tournamentApi'
import './Tournament.css'

export default function TournamentCreate() {
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()
  const [name, setName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(8)
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

    setIsSubmitting(true)
    setError('')
    try {
      const created = await createTournament({
        name: name.trim(),
        maxPlayers,
        format: 'single_elimination',
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
