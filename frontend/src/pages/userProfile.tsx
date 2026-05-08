import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { User } from "../contexts/AuthContext"
import { useAuth } from "../contexts/AuthContext"
import "./userProfile.css"

export default function UserProfile() {
    const { user, updateProfile, logout } = useAuth()
    const navigate = useNavigate()
    const [displayName, setDisplayName] = useState(user?.displayName || "")
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "")
    const [githubId, setGithubId] = useState(user?.githubId || "")
    const [twitterId, setTwitterId] = useState(user?.twitterId || "")
    const [discordId, setDiscordId] = useState(user?.discordId || "")
    const [isEditing, setIsEditing] = useState(false)

    useEffect(() => {
        if (user) {
            setDisplayName(user.displayName || "")
            setAvatarUrl(user.avatarUrl || "")
            setGithubId(user.githubId || "")
            setTwitterId(user.twitterId || "")
            setDiscordId(user.discordId || "")
        }
    }, [user])

    const handleUpdate = () => {
        const updates: Partial<User> = {}

        if (displayName !== user?.displayName) updates.displayName = displayName
        if (avatarUrl !== user?.avatarUrl) updates.avatarUrl = avatarUrl
        if (githubId !== user?.githubId) updates.githubId = githubId
        if (twitterId !== user?.twitterId) updates.twitterId = twitterId
        if (discordId !== user?.discordId) updates.discordId = discordId

        if (Object.keys(updates).length > 0) {
            updateProfile(updates)
        }
        setIsEditing(false)
    }

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    if (!user) return null

    const winRate = user.matches > 0 ? Math.round((user.won / user.matches) * 100) : 0

    return (
        <div className="profile-shell">
            <header className="terminal-topbar">
                <span onClick={() => navigate('/')} style={{ cursor: 'pointer' }} className="cli-brand">root@vim-royale:~#</span>
                <nav className="cli-nav">
                    <span onClick={() => navigate('/')}>{':match'}</span>
                    <span onClick={() => navigate('/leaderboard')}>{':leaderboard'}</span>
                    <span>{':docs'}</span>
                    <span onClick={handleLogout} style={{ cursor: 'pointer' }}>
                        :logout [{user.email}]
                    </span>
                </nav>
            </header>

            <main className="profile-main">
                <section className="profile-hero">
                    <div className="profile-avatar-section">
                        <img 
                            src={avatarUrl || 'https://github.com/identicons/github.png'} 
                            alt="avatar" 
                            className="profile-avatar"
                        />
                        <div className="profile-id-badge">
                            <span className="profile-rating">{Math.round(user.rating || 0)}</span>
                            <span className="profile-rating-label">ELO</span>
                        </div>
                    </div>
                    
                    <div className="profile-info">
                        <h1 className="profile-name">{displayName || 'Anonymous User'}</h1>
                        <p className="profile-email">{'<'}{user.email}{'>'}</p>
                        
                        <div className="profile-stats">
                            <div className="stat-box">
                                <span className="stat-value">{user.matches}</span>
                                <span className="stat-label">MATCHES</span>
                            </div>
                            <div className="stat-box">
                                <span className="stat-value win">{user.won}</span>
                                <span className="stat-label">WON</span>
                            </div>
                            <div className="stat-box">
                                <span className="stat-value loss">{user.lost}</span>
                                <span className="stat-label">LOST</span>
                            </div>
                            <div className="stat-box">
                                <span className="stat-value">{winRate}%</span>
                                <span className="stat-label">WIN_RATE</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="profile-edit-section">
                    <div className="section-header">
                        <h2>&gt;&gt; USER_CONFIG</h2>
                        <button 
                            className="edit-toggle-btn"
                            onClick={() => isEditing ? handleUpdate() : setIsEditing(true)}
                        >
                            {isEditing ? './SAVE.sh' : 'vi profile'}
                        </button>
                    </div>

                    <div className="config-form">
                        <div className="form-row">
                            <label>:display_name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                disabled={!isEditing}
                                placeholder="Enter display name..."
                            />
                        </div>


                        <div className="form-row">
                            <label>:github_id</label>
                            <input
                                type="text"
                                value={githubId}
                                onChange={(e) => setGithubId(e.target.value)}
                                disabled={!isEditing}
                                placeholder="username"
                            />
                        </div>

                        <div className="form-row">
                            <label>:twitter_id</label>
                            <input
                                type="text"
                                value={twitterId}
                                onChange={(e) => setTwitterId(e.target.value)}
                                disabled={!isEditing}
                                placeholder="@handle"
                            />
                        </div>

                        <div className="form-row">
                            <label>:discord_id</label>
                            <input
                                type="text"
                                value={discordId}
                                onChange={(e) => setDiscordId(e.target.value)}
                                disabled={!isEditing}
                                placeholder="username#0000"
                            />
                        </div>
                    </div>
                </section>

                <section className="profile-meta">
                    <div className="meta-row">
                        <span className="meta-label">last_active:</span>
                        <span className="meta-value">{user.lastActive || 'N/A'}</span>
                    </div>
                </section>
            </main>
        </div>
    )
}