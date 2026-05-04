import { EditorView } from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'
import { useEffect, useRef, useState } from 'react'
import {
  MATCH_TOAST_DURATION_MS,
  TARGET_CODE,
} from './typingChallenge/constants'
import { createEditorState } from './typingChallenge/editorState'
import { polluteCode } from './typingChallenge/polluteCode'
import { formatVimMode } from './typingChallenge/vimMode'
import './TypingChallenge.css'

export default function TypingChallenge() {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const leftViewRef = useRef<EditorView | null>(null)
  const rightViewRef = useRef<EditorView | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [vimMode, setVimMode] = useState('NORMAL')
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return

    const handleChange = () => {
      if (!leftViewRef.current || !rightViewRef.current) return

      const leftContent = leftViewRef.current.state.doc.toString()
      const rightContent = rightViewRef.current.state.doc.toString()

      if (leftContent !== rightContent) {
        setShowToast(false)
        return
      }

      setShowToast(true)
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
      toastTimeoutRef.current = setTimeout(() => {
        setShowToast(false)
        toastTimeoutRef.current = null
      }, MATCH_TOAST_DURATION_MS)
    }

    const rightState = createEditorState({
      content: TARGET_CODE,
      readOnly: true,
    })
    const rightView = new EditorView({
      state: rightState,
      parent: rightRef.current,
    })
    rightViewRef.current = rightView

    const leftState = createEditorState({
      content: polluteCode(TARGET_CODE),
      readOnly: false,
      onDocChanged: handleChange,
    })
    const leftView = new EditorView({
      state: leftState,
      parent: leftRef.current,
    })
    leftViewRef.current = leftView

    const leftCM = getCM(leftView)
    const handleVimModeChange = (event: { mode?: string; subMode?: string }) => {
      setVimMode(formatVimMode(event.mode, event.subMode))
    }

    leftCM?.on('vim-mode-change', handleVimModeChange)
    setVimMode('NORMAL')

    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
      leftCM?.off('vim-mode-change', handleVimModeChange)
      leftView.destroy()
      rightView.destroy()
    }
  }, [])

  return (
    <div className="challenge-shell">
      <div className="editor-grid">
        <section className="editor-panel">
          <div ref={leftRef} className="editor-mount" />
          <div className="vim-mode-badge">-- {vimMode} --</div>
        </section>

        <section className="editor-panel">
          <div ref={rightRef} className="editor-mount" />
        </section>
      </div>
      {showToast && <div className="match-toast">Match</div>}
    </div>
  )
}
