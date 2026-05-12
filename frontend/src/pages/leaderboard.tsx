import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { TerminalLayout } from "../components/TerminalLayout/TerminalLayout"
import { API_URL } from "../config"
import { useCRT } from "../contexts/CRTContext"
import "./leaderboard.css"

type LeaderboardEntry = {
    user_id: number
    displayName: string | null
    rating: number
    username: string
    avatarUrl: string | null
}

const MEDALS = ['◈', '◇', '△']

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
        <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
            <main className="lb-main">

                <header className="lb-header">
                    <h1 className="lb-title">TOP_PLAYERS</h1>
                    <div className="lb-header-line" />
                </header>

                {isLoading ? (
                    <div className="lb-loading">
                        <span className="lb-loading-cursor" />
                        fetching leaderboard data...
                    </div>
                ) : entries.length === 0 ? (
                    <div className="lb-empty">
                        <span className="lb-empty-icon">⌀</span>
                        <span>no players yet — start a match!</span>
                    </div>
                ) : (
                    <div className="lb-table-wrap">
                        <div className="lb-table-header">
                            <span className="lb-th lb-th--rank">rank</span>
                            <span className="lb-th lb-th--player">player</span>
                            <span className="lb-th lb-th--elo">elo</span>
                        </div>
                        <div className="lb-table-body">
                            {entries.map((entry, i) => {
                                const rank = i + 1
                                const isTop3 = rank <= 3
                                return (
                                    <div
                                        key={entry.user_id}
                                        className={`lb-row ${isTop3 ? `lb-row--${rank}` : ''}`}
                                        style={{ animationDelay: `${i * 0.06}s` }}
                                        onClick={() => navigate(`/users/${entry.username}`)}
                                    >
                                        <span className={`lb-row-rank ${isTop3 ? `lb-row-rank--${rank}` : ''}`}>
                                            {isTop3 ? MEDALS[rank - 1] : `#${rank}`}
                                        </span>
                                        <span className="lb-row-player">
                                            <img
                                                referrerPolicy="no-referrer"
                                                src={entry.avatarUrl || ''}
                                                alt="pfp"
                                                className={`lb-row-avatar ${isTop3 ? `lb-row-avatar--${rank}` : ''}`}
                                            />
                                            <span className={`lb-row-name ${isTop3 ? `lb-row-name--${rank}` : ''}`}>
                                                {entry.displayName || 'Anonymous'}
                                            </span>
                                        </span>
                                        <span className={`lb-row-elo ${isTop3 ? `lb-row-elo--${rank}` : ''}`}>
                                            {Math.round(entry.rating)}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </main>
        </TerminalLayout>
    )
}