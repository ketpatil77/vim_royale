import { useRef, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'
import { createEditorState } from './editorState'
import { formatVimMode } from './vimMode'

type UseEditorsOptions = {
  targetCode: string
  pollutedCode: string
  onContentChange?: (content: string) => void
}

export function useEditors() {
  const targetRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  const targetViewRef = useRef<EditorView | null>(null)
  const leftViewRef = useRef<EditorView | null>(null)
  const rightViewRef = useRef<EditorView | null>(null)

  const cleanup = useCallback(() => {
    targetViewRef.current?.destroy()
    leftViewRef.current?.destroy()
    rightViewRef.current?.destroy()
    targetViewRef.current = null
    leftViewRef.current = null
    rightViewRef.current = null
  }, [])

  const setEditors = useCallback(
    (
      options: UseEditorsOptions,
      onVimModeChange: (mode: string) => void
    ) => {
      if (!targetRef.current || !leftRef.current || !rightRef.current) return cleanup()

      cleanup()

      const { targetCode, pollutedCode, onContentChange } = options

      const targetState = createEditorState({
        content: targetCode,
        readOnly: true,
      })
      const targetView = new EditorView({
        state: targetState,
        parent: targetRef.current,
      })
      targetViewRef.current = targetView

      const leftState = createEditorState({
        content: pollutedCode,
        readOnly: false,
        onDocChanged: onContentChange,
      })
      const leftView = new EditorView({
        state: leftState,
        parent: leftRef.current,
      })
      leftViewRef.current = leftView

      const rightState = createEditorState({
        content: pollutedCode,
        readOnly: true,
      })
      const rightView = new EditorView({
        state: rightState,
        parent: rightRef.current,
      })
      rightViewRef.current = rightView

      const leftCM = getCM(leftView)
      const handleVimModeChange = (event: { mode?: string; subMode?: string }) => {
        const mode = formatVimMode(event.mode, event.subMode)
        onVimModeChange(mode)
      }

      leftCM?.on('vim-mode-change', handleVimModeChange)
      onVimModeChange('NORMAL')

      return () => {
        leftCM?.off('vim-mode-change', handleVimModeChange)
        cleanup()
      }
    },
    [cleanup]
  )

  const replaceOpponentContent = useCallback((content: string) => {
    if (!rightViewRef.current) return
    const current = rightViewRef.current.state.doc.toString()
    if (current === content) return

    rightViewRef.current.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: content,
      },
    })
  }, [])

  const getPlayerContent = useCallback(() => {
    return leftViewRef.current?.state.doc.toString() ?? ''
  }, [])

  return {
    targetRef,
    leftRef,
    rightRef,
    cleanup,
    setEditors,
    replaceOpponentContent,
    getPlayerContent,
  }
}