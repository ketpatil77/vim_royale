import { EditorView } from "@codemirror/view";
import { getCM, Vim, type CodeMirror } from "@replit/codemirror-vim";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorPanel } from "../../components/EditorPanel/EditorPanel";
import { TerminalLayout } from "../../components/TerminalLayout/TerminalLayout";
import { useCRT } from "../../contexts/CRTContext";
import "../Play/MatchPage.css";
import { createEditorState } from "../typingChallenge/editorState";
import vimtutorContent from "./vimtutor.txt?raw";
import "./vimTutor.css";

const CHECKPOINT_KEY = "vimtutor_checkpoint";

type Checkpoint = {
  content: string;
  timestamp: number;
  cursorOffset?: number;
};

type TutorCommandHandlers = {
  write: () => void;
  quit: () => void;
  writeQuit: () => void;
};

const tutorCommandHandlers = new WeakMap<EditorView, TutorCommandHandlers>();
let vimTutorExCommandsRegistered = false;

function readCheckpoints(): Checkpoint[] {
  try {
    const value = JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || "[]");
    if (!Array.isArray(value)) return [];

    return value.filter(
      (checkpoint): checkpoint is Checkpoint =>
        typeof checkpoint?.content === "string" &&
        typeof checkpoint?.timestamp === "number",
    );
  } catch {
    return [];
  }
}

function saveCheckpoint(content: string, cursorOffset: number) {
  const checkpoints = readCheckpoints();
  checkpoints.push({
    content,
    cursorOffset,
    timestamp: Date.now(),
  });
  if (checkpoints.length > 10) {
    checkpoints.shift();
  }
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoints));
}

function clearCheckpoints() {
  localStorage.removeItem(CHECKPOINT_KEY);
}

function getInitialCheckpoint() {
  const checkpoints = readCheckpoints();
  return checkpoints.at(-1) ?? { content: vimtutorContent, timestamp: Date.now() };
}

function formatSavedTime(timestamp: number | null) {
  if (!timestamp) return "No saved tutor state";

  return `Saved locally at ${new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getTutorHandlers(cm: CodeMirror) {
  return tutorCommandHandlers.get(cm.cm6);
}

function registerVimTutorExCommands() {
  if (vimTutorExCommandsRegistered) return;
  vimTutorExCommandsRegistered = true;

  Vim.defineEx("write", "w", (cm) => {
    const handlers = getTutorHandlers(cm);
    if (handlers) {
      handlers.write();
      return;
    }

    cm.save?.();
  });

  Vim.defineEx("quit", "q", (cm) => {
    getTutorHandlers(cm)?.quit();
  });

  Vim.defineEx("wq", "wq", (cm) => {
    getTutorHandlers(cm)?.writeQuit();
  });
}

export function VimTutor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const [vimMode, setVimMode] = useState("Normal");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => {
    return readCheckpoints().at(-1)?.timestamp ?? null;
  });
  const [resetArmed, setResetArmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Use :w to save your tutor progress.");
  const { crtEnabled, toggleCrt } = useCRT();

  useEffect(() => {
    if (!editorRef.current) return;
    registerVimTutorExCommands();
    const initialCheckpoint = getInitialCheckpoint();

    const state = createEditorState({
      content: initialCheckpoint.content,
      readOnly: false,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    editorViewRef.current = view;

    const cursorOffset = Math.min(
      initialCheckpoint.cursorOffset ?? 0,
      view.state.doc.length,
    );
    view.dispatch({
      selection: { anchor: cursorOffset },
      scrollIntoView: true,
    });
    view.focus();

    const cm = getCM(view);
    const write = () => {
      saveCheckpoint(view.state.doc.toString(), view.state.selection.main.head);
      const savedAt = Date.now();
      setLastSavedAt(savedAt);
      setStatusMessage("Tutor progress saved.");
      setResetArmed(false);
    };
    const quit = () => window.history.back();

    tutorCommandHandlers.set(view, {
      write,
      quit,
      writeQuit: () => {
        write();
        quit();
      },
    });

    const handleVimModeChange = (e: { mode?: string; subMode?: string }) => {
      setVimMode(e.mode || "Normal");
    };
    cm?.on("vim-mode-change", handleVimModeChange);

    return () => {
      cm?.off("vim-mode-change", handleVimModeChange);
      tutorCommandHandlers.delete(view);
      if (editorViewRef.current === view) {
        editorViewRef.current = null;
      }
      view.destroy();
    };
  }, []);

  const resetTutorState = useCallback(() => {
    if (!resetArmed) {
      setResetArmed(true);
      setStatusMessage("Press Confirm Reset to clear saved VimTutor progress.");
      return;
    }

    clearCheckpoints();
    const view = editorViewRef.current;

    if (view) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: vimtutorContent,
        },
        selection: { anchor: 0 },
        scrollIntoView: true,
      });
      view.focus();
    }

    setLastSavedAt(null);
    setResetArmed(false);
    setStatusMessage("VimTutor reset to the original lesson.");
  }, [resetArmed]);

  return (
    <TerminalLayout 
    crtEnabled={crtEnabled} 
    onCrtToggle={toggleCrt}>
      <main className="vimtutor-page">
        <section className="vimtutor-shell" aria-labelledby="vimtutor-title">
          <header className="vimtutor-header">
            <div>
              <h1 id="vimtutor-title">Vim Tutor</h1>
              <p className="vimtutor-meta">{formatSavedTime(lastSavedAt)}</p>
            </div>
            <div className="vimtutor-actions">
              <p className="vimtutor-status" role="status">{statusMessage}</p>
              <button
                type="button"
                className={`vimtutor-reset-button ${resetArmed ? "vimtutor-reset-button--armed" : ""}`}
                onClick={resetTutorState}
              >
                {resetArmed ? "Confirm Reset" : "Reset Saved State"}
              </button>
            </div>
          </header>

          <div className="vimtutor-editor-frame">
            <EditorPanel
              filename="vimtutor.txt"
              panelTitle="VIM TUTOR"
              displayName="vim-disciple"
              vimMode={vimMode}
              rating={1500}
              scrollWarningMessage="Use keyboard to navigate, scroll wheel is disabled"
              ref={editorRef}
            />
          </div>
        </section>
      </main>
    </TerminalLayout>
  );
}
