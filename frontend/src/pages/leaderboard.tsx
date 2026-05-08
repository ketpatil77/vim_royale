import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { API_URL } from "../config"
import { useAuth } from "../contexts/AuthContext"
import "./leaderboard.css"

type LeaderboardEntry = {
    user_id: number
    displayName: string | null
    rating: number
    avatarUrl: string | null
}

export default function Leaderboard() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetch(`${API_URL}/leaderboard`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => setEntries(data))
            .finally(() => setIsLoading(false))
    }, [])

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    return (
        <div className="leaderboard-shell">
            <header className="terminal-topbar">
                <a href="/" className="cli-brand">root@vim-royale:~#</a>
                <nav className="cli-nav">
                    <span onClick={() => navigate('/')}>{':match'}</span>
                    <span>{':leaderboard'}</span>
                    <span onClick={() => navigate('/userProfile')}>{':profile'}</span>
                    <span onClick={handleLogout} style={{ cursor: 'pointer' }}>
                        :logout [{user?.email}]
                    </span>
                </nav>
            </header>

            <main className="leaderboard-main">
                <section className="leaderboard-header">
                    <h1>&gt;&gt; TOP_PLAYERS</h1>
                    <p className="subtitle">ranked by ELO rating</p>
                </section>

                {isLoading ? (
                    <div className="loading">Loading leaderboard...</div>
                ) : entries.length === 0 ? (
                    <div className="empty-state">no players yet - start a match!</div>
                ) : (
                    <table className="leaderboard-table">
                        <thead>
                            <tr>
                                <th className="col-rank">rank</th>
                                <th className="col-player">player</th>
                                <th className="col-rating">ELO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, idx) => (
                                <tr key={entry.user_id} className={idx < 3 ? `rank-${idx + 1}` : ''}>
                                    <td className="col-rank">
                                        <span className="rank-number">{idx + 1}</span>
                                    </td>
                                    <td className="col-player">
                                        <img
                                            src={entry.avatarUrl || 'https://github.com/identicons/github.png'}
                                            alt="avatar"
                                            className="player-avatar"
                                            referrerPolicy="no-referrer"
                                        />
                                        <span className="player-name">
                                            {entry.displayName || 'Anonymous'}
                                        </span>
                                    </td>
                                    <td className="col-rating">
                                        <span className="rating-value">{Math.round(entry.rating)}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </main>
        </div>
    )
}