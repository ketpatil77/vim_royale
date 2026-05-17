import { EditorView } from "@codemirror/view";
import { getCM } from "@replit/codemirror-vim";
import { useEffect, useRef, useState } from "react";
import { EditorPanel } from "../../components/EditorPanel/EditorPanel";
import { TerminalLayout } from "../../components/TerminalLayout/TerminalLayout";
import { useCRT } from "../../contexts/CRTContext";
import "../Play/MatchPage.css";
import { createEditorState } from "../typingChallenge/editorState";
import vimtutorContent from "./vimtutor.txt?raw";

export function VimTutor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [vimMode, setVimMode] = useState("Normal");
  const { crtEnabled, toggleCrt } = useCRT()

  useEffect(() => {
    if (!editorRef.current) return;

    const state = createEditorState({
      content: vimtutorContent,
      readOnly: false,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    view.focus();

    const cm = getCM(view);
    cm?.on("vim-mode-change", (e: { mode?: string; subMode?: string }) => {
      console.log(e.mode);
      setVimMode(e.mode || "Normal");
    });

    return () => view.destroy();
  }, []);

  return (
    <TerminalLayout 
    crtEnabled={crtEnabled} 
    onCrtToggle={toggleCrt}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '24px', flex: 1 }}>
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
    </TerminalLayout>
  );
}

