import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { API_URL } from "../config"
import { TerminalLayout } from "../components/TerminalLayout"
import "./leaderboard.css"
import { useCRT } from "../contexts/CRTContext"

type LeaderboardEntry = {
    user_id: number
    displayName: string | null
    rating: number
    username: string
    avatarUrl: string | null
}

export default function Leaderboard() {
    const { crtEnabled, toggleCrt } = useCRT()
    const navigate = useNavigate()
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetch(`${API_URL}/leaderboard`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => setEntries(data))
            .finally(() => setIsLoading(false))
    }, [])

    return (
        <TerminalLayout
            crtEnabled={crtEnabled}
            onCrtToggle={toggleCrt}>
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
                                <th className="col-player"><span>player</span></th>
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
                                        <span className="col-player-inner">
                                            <img src={entry.avatarUrl || ''} alt="pfp" className="pfp" />
                                            <span
                                                className="player-name"
                                                onClick={() => navigate(`/users/${entry.username}`)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {entry.displayName || 'Anonymous'}
                                            </span>
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
        </TerminalLayout>
    )
}