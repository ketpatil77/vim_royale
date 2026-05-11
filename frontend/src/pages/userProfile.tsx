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
            <p className="profile-email">
              {"<"}
              {userData.email}
              {">"}
            </p>

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
                <div className="social">
                  <span className="social-label">github:</span>
                  <span className="social-value">{userData.githubId}</span>
                </div>
              )}
              {userData.twitterId && (
                <div className="social">
                  <span className="social-label">twitter:</span>
                  <span className="social-value">{userData.twitterId}</span>
                </div>
              )}
              {userData.discordId && (
                <div className="social">
                  <span className="social-label">discord:</span>
                  <span className="social-value">{userData.discordId}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="profile-meta">
          <div className="meta-row">
            <span className="meta-label">last_active:</span>
            <span className="meta-value">{userData.lastActive || "N/A"}</span>
          </div>
        </section>
      </main>
    </TerminalLayout>
  );
}

