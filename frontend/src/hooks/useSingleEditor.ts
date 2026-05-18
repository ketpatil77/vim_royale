import { useRef, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'
import { createEditorState } from '../pages/typingChallenge/editorState'
import { formatVimMode } from '../pages/typingChallenge/vimMode'

export function useSingleEditor() {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)

  const cleanup = useCallback(() => {
    viewRef.current?.destroy()
    viewRef.current = null
  }, [])

  const setEditor = useCallback(
    (
      options: { pollutedCode: string; onContentChange?: (content: string) => void },
      onVimModeChange: (mode: string) => void
    ) => {
      if (!editorRef.current) return cleanup()

      cleanup()

      const { pollutedCode, onContentChange } = options

      const state = createEditorState({
        content: pollutedCode,
        readOnly: false,
        onDocChanged: onContentChange,
      })

      const view = new EditorView({
        state,
        parent: editorRef.current,
      })

      viewRef.current = view
      view.focus()

      const cm = getCM(view)
      const handleVimModeChange = (event: { mode?: string; subMode?: string }) => {
        const mode = formatVimMode(event.mode, event.subMode)
        onVimModeChange(mode)
      }

      cm?.on('vim-mode-change', handleVimModeChange)
      onVimModeChange('NORMAL')

      return () => {
        cm?.off('vim-mode-change', handleVimModeChange)
        cleanup()
      }
    },
    [cleanup]
  )

  const getContent = useCallback(() => {
    return viewRef.current?.state.doc.toString() ?? ''
  }, [])

  const replaceContent = useCallback((content: string) => {
    if (!viewRef.current) return
    const current = viewRef.current.state.doc.toString()
    if (current === content) return

    viewRef.current.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: content,
      },
    })
  }, [])

  return {
    editorRef,
    cleanup,
    setEditor,
    getContent,
    replaceContent,
  }
}