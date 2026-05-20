import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

interface UseTerminalCommandsProps {
  navigate: (path: string) => void;
  user: { email: string } | null;
  onLogout: () => Promise<void>;
  onCrtToggle?: () => void;
}

export interface TerminalCommandsState {
  command: string;
  cmdFeedback: string | null;
}

export function useTerminalCommands({
  navigate,
  user,
  onLogout,
  onCrtToggle,
}: UseTerminalCommandsProps) {
  const [command, setCommand] = useState("");
  const [cmdFeedback, setCmdFeedback] = useState<string | null>(null);

  const clearCommand = useCallback(() => {
    setCommand("");
    setCmdFeedback(null);
  }, []);

  const { loginFunc } = useAuth()

  const COMMANDS = useMemo<Record<string, () => void>>(
    () => ({
      play: () => {
        navigate("/play");
        clearCommand();
      },
      leaderboard: () => {
        navigate("/leaderboard");
        clearCommand();
      },
      lb: () => {
        navigate("/leaderboard");
        clearCommand();
      },
      guide: () => {
        navigate("/walkthrough");
        clearCommand();
      },
      walkthrough: () => {
        navigate("/walkthrough");
        clearCommand();
      },
      login: () => {
        navigate("/login");
        clearCommand();
      },
      authenticate: () => {
        navigate("/login");
        clearCommand();
      },
      google: () => {
        if (window.location.pathname == "/login") {
          loginFunc("google");
        }
        clearCommand();
      },
      github: () => {
        if (window.location.pathname == "/login") {
          loginFunc("github");
        }
        clearCommand();
      },
      back: () => {
        window.history.back();
        clearCommand();
      },
      forward: () => {
        window.history.forward();
        clearCommand();
      },
      home: () => {
        navigate("/");
        clearCommand();
      },
      root: () => {
        navigate("/");
        clearCommand();
      },
      q: () => {
        window.history.back();
        clearCommand();
      },
      docs: () => {
        navigate("/docs");
        clearCommand();
      },
      tutor: () => {
        navigate("/docs/vimtutor");
        clearCommand();
      },
      vimtutor: () => {
        navigate("/docs/vimtutor");
        clearCommand();
      },
      profile: () => {
        if (user) {
          navigate("/editprofile");
        } else {
          setCmdFeedback("profile: command requires login");
          setTimeout(clearCommand, 1500);
          return;
        }
        clearCommand();
      },
      logout: () => {
        onLogout();
        clearCommand();
      },
      crt: () => {
        onCrtToggle?.();
        clearCommand();
      },
      // easter eggs
      emacs: () => {
        setCmdFeedback("bruh.");
        setTimeout(clearCommand, 1500);
        return;
      },
      neovim: () => {
        setCmdFeedback("blazingly fast!");
        setTimeout(clearCommand, 1500);
        return;
      },
    }),
    [clearCommand, loginFunc, navigate, onCrtToggle, onLogout, user]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const tag = target.tagName;

      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (event.key === ":") {
        setCommand(":");
        setCmdFeedback(null);
        return;
      }

      if (!command) return;

      if (event.key === "Enter") {
        const cmd = command.slice(1);
        if (COMMANDS[cmd]) {
          COMMANDS[cmd]();
        } else {
          setCmdFeedback(`${cmd}: not an editor command`);
          setTimeout(clearCommand, 1500);
        }
      } else if (event.key === "Escape") {
        clearCommand();
      } else if (event.key === "Backspace" && command.length > 1) {
        setCommand((prev) => prev.slice(0, -1));
      } else if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
        setCommand((prev) => prev + event.key);
      }
    },
    [COMMANDS, command, clearCommand]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    command,
    cmdFeedback,
    clearCommand,
  };
}
