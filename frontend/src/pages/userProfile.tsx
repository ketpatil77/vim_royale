import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TerminalLayout } from "../components/TerminalLayout/TerminalLayout";
import { API_URL } from "../config";
import { useCRT } from "../contexts/CRTContext";
import "./userProfile.css";

type UserData = {
  id: number;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  githubId: string | null;
  twitterId: string | null;
  discordId: string | null;
  matches: number;
  won: number;
  lost: number;
  rating: number;
  lastActive: string;
};

function getHoursAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "just now";
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export default function UserProfile() {
  const { username } = useParams();
  const { crtEnabled, toggleCrt } = useCRT()
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setError("No username provided");
      setIsLoading(false);
      return;
    }

    fetch(`${API_URL}/users/${username}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          throw new Error("User not found");
        }
        return res.json();
      })
      .then((data) => {
        setUserData(data);
      })
      .catch((err) => {
        setError(err.message || "Failed to load user");
      })
      .finally(() => setIsLoading(false));
  }, [username]);

  if (isLoading) {
    return (
      <TerminalLayout
        crtEnabled={crtEnabled}
        onCrtToggle={toggleCrt}>
        <div className="profile-main">
          <div className="loading">Loading...</div>
        </div>
      </TerminalLayout>
    );
  }

  if (error || !userData) {
    return (
      <TerminalLayout>
        <div className="profile-main">
          <div className="error">{error || "User not found"}</div>
        </div>
      </TerminalLayout>
    );
  }

  const winRate =
    userData.matches > 0
      ? Math.round((userData.won / userData.matches) * 100)
      : 0;

  return (
    <TerminalLayout
    crtEnabled={crtEnabled}
    onCrtToggle={toggleCrt}>
      <main className="profile-main">
        <section className="profile-hero">
          <div className="profile-avatar-section">
            <img
              src={
                userData.avatarUrl || "https://github.com/identicons/github.png"
              }
              alt="avatar"
              className="profile-avatar"
              referrerPolicy="no-referrer"
            />
            <div className="profile-id-badge">
              <span className="profile-rating">
                {Math.round(userData.rating || 0)}
              </span>
              <span className="profile-rating-label">ELO</span>
            </div>
          </div>

          <div className="profile-info">
            <h1 className="profile-name">
              {userData.displayName || "Anonymous User"}
            </h1>
            <p className="profile-username">@{username}</p>
            <p className="profile-last-active">last_active: {getHoursAgo(userData.lastActive)}</p>

            <div className="profile-stats">
              <div className="stat-box">
                <span className="stat-value">{userData.matches}</span>
                <span className="stat-label">MATCHES</span>
              </div>
              <div className="stat-box">
                <span className="stat-value win">{userData.won}</span>
                <span className="stat-label">WON</span>
              </div>
              <div className="stat-box">
                <span className="stat-value loss">{userData.lost}</span>
                <span className="stat-label">LOST</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{winRate}%</span>
                <span className="stat-label">WIN_RATE</span>
              </div>
            </div>

            <div className="socials">
              {userData.githubId && (
                <a
                  href={`https://github.com/${userData.githubId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                  aria-label="GitHub"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="social-icon">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              )}
              {userData.twitterId && (
                <a
                  href={`https://x.com/${userData.twitterId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                  aria-label="Twitter"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="social-icon">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
              )}
              {userData.discordId && (
                <a
                  href={`https://discord.com/users/${userData.discordId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                  aria-label="Discord"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="social-icon">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3938-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                  </svg>
                </a>
              )}
            </div>
          </div>
        </section>
      </main>
    </TerminalLayout>
  );
}

