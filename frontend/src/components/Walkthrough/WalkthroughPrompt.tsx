import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "../../contexts/AuthContext";
import "./WalkthroughPrompt.css";

const hiddenRoutes = ["/login", "/auth/callback", "/walkthrough"];

function getStorageKey(user: User) {
  return `vim-royale:walkthrough-seen:${user.id ?? user.email}`;
}

export function WalkthroughPrompt({ user }: { user: User | null }) {
  const [dismissedStorageKey, setDismissedStorageKey] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const storageKey = user ? getStorageKey(user) : "";
  const hasSeenLocalPrompt =
    Boolean(user) && window.localStorage.getItem(storageKey) === "true";
  const isVisible =
    Boolean(user) &&
    !hiddenRoutes.includes(location.pathname) &&
    !user?.hasSeenWalkthrough &&
    !hasSeenLocalPrompt &&
    dismissedStorageKey !== storageKey;

  if (!user || !isVisible) {
    return null;
  }

  const markSeen = () => {
    window.localStorage.setItem(storageKey, "true");
    setDismissedStorageKey(storageKey);
  };

  const startTour = () => {
    markSeen();
    navigate("/walkthrough");
  };

  return (
    <div className="walkthrough-prompt-backdrop" role="presentation">
      <section
        className="walkthrough-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkthrough-prompt-title"
      >
        <div className="walkthrough-prompt-topline">
          <span>first_login.md</span>
          <button type="button" onClick={markSeen} aria-label="Dismiss walkthrough prompt">
            :q
          </button>
        </div>
        <div className="walkthrough-prompt-body">
          <p className="walkthrough-prompt-command">:walkthrough</p>
          <h2 id="walkthrough-prompt-title">Want the two-minute tour?</h2>
          <p>
            Learn the commands, match flow, and exact buffer rule before you jump into a duel.
          </p>
        </div>
        <div className="walkthrough-prompt-actions">
          <button type="button" className="walkthrough-prompt-secondary" onClick={markSeen}>
            Skip
          </button>
          <button type="button" className="walkthrough-prompt-primary" onClick={startTour}>
            Start Tour
          </button>
        </div>
      </section>
    </div>
  );
}
