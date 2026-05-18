import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import VimGlyphBackground from "../AnimatedBackgrounds/VimGlyphBackground";
import "./TerminalLayout.css";
import { useTerminalCommands } from "./useTerminalCommands";

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

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);


  return (
    <div className="terminal-shell">
      <VimGlyphBackground style={{zIndex: 0, pointerEvents: 'none'}}/>
      <header className="terminal-topbar">
        <span
          onClick={() => { navigate("/"); closeMenu(); }}
          className="cli-brand"
          style={{ cursor: "pointer" }}
        >
          root@vim-royale:~#
        </span>

        <button
          className="terminal-hamburger"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`hamburger-line ${isMenuOpen ? "open" : ""}`} />
          <span className={`hamburger-line ${isMenuOpen ? "open" : ""}`} />
          <span className={`hamburger-line ${isMenuOpen ? "open" : ""}`} />
        </button>

        {isMenuOpen && (
          <div className="terminal-menu-backdrop" onClick={closeMenu} />
        )}

        <nav className={`terminal-nav ${isMenuOpen ? "open" : ""}`}>
          <button
            className="terminal-crt-toggle"
            onClick={() => { onCrtToggle?.(); closeMenu(); }}
            aria-label="Toggle CRT effect"
            aria-pressed={crtEnabled}
            title={crtEnabled ? "CRT effect: ON" : "CRT effect: OFF"}
          >
            <span className="terminal-crt-toggle-label">:crt</span>
            <span className="terminal-crt-toggle-track">
              <span className="terminal-crt-toggle-thumb" />
            </span>
          </button>

          <span
            onClick={() => { navigate("/leaderboard"); closeMenu(); }}
            className="terminal-nav-link"
          >
            :leaderboard
          </span>
          <span onClick={() => {navigate("docs/vimtutor")}} className="terminal-nav-link">:tutor</span>

          {user ? (
            <span
              onClick={() => { navigate("/editprofile"); closeMenu(); }}
              className="terminal-nav-link"
            >
              :profile
            </span>
          ) : (
            <span
              onClick={() => { navigate("/login"); closeMenu(); }}
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

