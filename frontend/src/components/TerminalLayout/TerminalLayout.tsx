import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTerminalCommands } from "./useTerminalCommands";
import "./TerminalLayout.css";

interface TerminalLayoutProps {
  children: ReactNode;
  crtEnabled?: boolean;
  onCrtToggle?: () => void;
}

export function TerminalLayout({
  children,
  crtEnabled = false,
  onCrtToggle,
}: TerminalLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const { command, cmdFeedback } = useTerminalCommands({
    navigate,
    user,
    onLogout: handleLogout,
    onCrtToggle,
  });

  return (
    <div className="terminal-shell">
      {crtEnabled && <div className="terminal-scanlines" aria-hidden="true" />}

      <header className="terminal-topbar">
        <span
          onClick={() => navigate("/")}
          className="cli-brand"
          style={{ cursor: "pointer" }}
        >
          root@vim-royale:~#
        </span>
        <nav className="terminal-nav">
          <span
            onClick={() => navigate("/leaderboard")}
            className="terminal-nav-link"
          >
            :leaderboard
          </span>
          <span className="terminal-nav-link">:docs</span>

          <span
            onClick={onCrtToggle}
            className="terminal-nav-link"
            style={{ cursor: "pointer" }}
          >
            :crt [{crtEnabled ? "on" : "off"}]
          </span>

          {user ? (
            <>
              <span
                onClick={() => navigate("/editProfile")}
                className="terminal-nav-link"
              >
                :profile
              </span>
              <span
                onClick={handleLogout}
                className="terminal-nav-link terminal-nav-link--logout"
                style={{ cursor: "pointer" }}
              >
                :logout [{user.email}]
              </span>
            </>
          ) : (
            <span
              onClick={() => navigate("/login")}
              className="terminal-nav-link"
            >
              :login
            </span>
          )}
        </nav>
      </header>

      <main className="terminal-main">{children}</main>

      {command && (
        <div className="terminal-cmdbar">
          {cmdFeedback ? (
            <span className="terminal-cmdbar-error">{cmdFeedback}</span>
          ) : (
            <span>
              {command}
              <span className="terminal-cmdbar-cursor">█</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

