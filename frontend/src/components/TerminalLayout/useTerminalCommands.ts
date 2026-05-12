import { useCallback, useEffect, useState } from "react";

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

  const COMMANDS: Record<string, () => void> = {
    leaderboard: () => {
      navigate("/leaderboard");
      clearCommand();
    },
    lb: () => {
      navigate("/leaderboard");
      clearCommand();
    },
    home: () => {
      navigate("/");
      clearCommand();
    },
    root: () => {
      navigate("/")
      clearCommand();
    },
    docs: () => {
      navigate("/docs");
      clearCommand();
    },
    vimtutor: () => {
      navigate("/docs/vimtutor");
      clearCommand();
    },
    profile: () => {
      if (user) {
        navigate("/editProfile");
      } else {
        setCmdFeedback("profile: command requires login");
        setTimeout(clearCommand, 1500);
        return;
      }
      clearCommand();
    },
    login: () => {
      navigate("/login");
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
  };

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
    [command, clearCommand]
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