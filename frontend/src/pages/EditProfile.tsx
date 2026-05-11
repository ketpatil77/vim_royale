import { useEffect, useState } from "react";
import { TerminalLayout } from "../components/TerminalLayout/TerminalLayout";
import type { User } from "../contexts/AuthContext";
import { useAuth } from "../contexts/AuthContext";
import { useCRT } from "../contexts/CRTContext";
import type { EditableProfileFields } from "../types";
import "./userProfile.css";

export default function EditProfile() {
  const {crtEnabled, toggleCrt} = useCRT();
  const { user, updateProfile } = useAuth();
  const [profileForm, setProfileForm] = useState<EditableProfileFields>({
    displayName: user?.displayName || "",
    avatarUrl: user?.avatarUrl || "",
    githubId: user?.githubId || "",
    twitterId: user?.twitterId || "",
    discordId: user?.discordId || "",
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        displayName: user.displayName || "",
        avatarUrl: user.avatarUrl || "",
        githubId: user.githubId || "",
        twitterId: user.twitterId || "",
        discordId: user.discordId || "",
      });
    }
  }, [user]);

  const handleUpdate = () => {
    const updates: Partial<User> = {};

    if (profileForm.displayName !== user?.displayName) updates.displayName = profileForm.displayName;
    if (profileForm.avatarUrl !== user?.avatarUrl) updates.avatarUrl = profileForm.avatarUrl;
    if (profileForm.githubId !== user?.githubId) updates.githubId = profileForm.githubId;
    if (profileForm.twitterId !== user?.twitterId) updates.twitterId = profileForm.twitterId;
    if (profileForm.discordId !== user?.discordId) updates.discordId = profileForm.discordId;

    if (Object.keys(updates).length > 0) {
      updateProfile(updates);
    }
    setIsEditing(false);
  };

  if (!user) return null;

  const winRate =
    (user.matches || 0) > 0 ? Math.round(((user.won || 0) / (user.matches || 0)) * 100) : 0;

  return (
    <TerminalLayout
    crtEnabled={crtEnabled}
    onCrtToggle={toggleCrt}
    >
      <main className="profile-main">
        <section className="profile-hero">
          <div className="profile-avatar-section">
            <img
              src={profileForm.avatarUrl || "https://github.com/identicons/github.png"}
              alt="avatar"
              className="profile-avatar"
            />
            <div className="profile-id-badge">
              <span className="profile-rating">
                {Math.round(user.rating || 0)}
              </span>
              <span className="profile-rating-label">ELO</span>
            </div>
          </div>

          <div className="profile-info">
            <h1 className="profile-name">
              {profileForm.displayName || "Anonymous User"}
            </h1>
            <p className="profile-email">
              {"<"}
              {user.email}
              {">"}
            </p>

            <div className="profile-stats">
              <div className="stat-box">
                <span className="stat-value">{user.matches || 0}</span>
                <span className="stat-label">MATCHES</span>
              </div>
              <div className="stat-box">
                <span className="stat-value win">{user.won || 0}</span>
                <span className="stat-label">WON</span>
              </div>
              <div className="stat-box">
                <span className="stat-value loss">{user.lost || 0}</span>
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
              onClick={() =>
                isEditing ? handleUpdate() : setIsEditing(true)
              }
            >
              {isEditing ? "./SAVE.sh" : "vi profile"}
            </button>
          </div>

          <div className="config-form">
            <div className="form-row">
              <label>:display_name</label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                disabled={!isEditing}
                placeholder="Enter display name..."
              />
            </div>

            <div className="form-row">
              <label>:github_id</label>
              <input
                type="text"
                value={profileForm.githubId}
                onChange={(e) => setProfileForm({ ...profileForm, githubId: e.target.value })}
                disabled={!isEditing}
                placeholder="username"
              />
            </div>

            <div className="form-row">
              <label>:twitter_id</label>
              <input
                type="text"
                value={profileForm.twitterId}
                onChange={(e) => setProfileForm({ ...profileForm, twitterId: e.target.value })}
                disabled={!isEditing}
                placeholder="@handle"
              />
            </div>

            <div className="form-row">
              <label>:discord_id</label>
              <input
                type="text"
                value={profileForm.discordId}
                onChange={(e) => setProfileForm({ ...profileForm, discordId: e.target.value })}
                disabled={!isEditing}
                placeholder="username#0000"
              />
            </div>
          </div>
        </section>

        <section className="profile-meta">
          <div className="meta-row">
            <span className="meta-label">last_active:</span>
            <span className="meta-value">{user.lastActive || "N/A"}</span>
          </div>
        </section>
      </main>
    </TerminalLayout>
  );
}