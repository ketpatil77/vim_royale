import { useRef, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { ChangeSet } from '@codemirror/state'
import { getCM } from '@replit/codemirror-vim'
import { createEditorState } from './editorState'
import { formatVimMode } from './vimMode'
import type { BufferDelta } from './types'

export function useEditors() {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  const leftViewRef = useRef<EditorView | null>(null)
  const rightViewRef = useRef<EditorView | null>(null)

  const cleanup = useCallback(() => {
    leftViewRef.current?.destroy()
    rightViewRef.current?.destroy()
    leftViewRef.current = null
    rightViewRef.current = null
  }, [])

  const setEditors = useCallback(
    (
      options: { pollutedCode: string; onContentChange?: (content: string, changes: ChangeSet) => void },
      onVimModeChange: (mode: string) => void
    ) => {
      if (!leftRef.current || !rightRef.current) return cleanup()

      cleanup()

      const { pollutedCode, onContentChange } = options

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
      leftView.focus();

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

  const changesToDelta = useCallback((changes: ChangeSet): BufferDelta => {
    const ops: BufferDelta['ops'] = []
    changes.iterChanges((from: number, to: number, _insertedFrom: number, _insertedTo: number, inserted: { toString: () => string }) => {
      if (from !== to) {
        ops.push({ type: 'delete', from, to })
      }
      if (inserted.toString()) {
        ops.push({ type: 'insert', pos: from, text: inserted.toString() })
      }
    })
    return { ops }
  }, [])

  const applyDelta = useCallback((delta: BufferDelta) => {
    if (!rightViewRef.current) return

    const view = rightViewRef.current
    const changes: { from: number; to?: number; insert?: string }[] = []

    for (const op of delta.ops) {
      if (op.type === 'delete') {
        changes.push({ from: op.from, to: op.to })
      } else if (op.type === 'insert') {
        changes.push({ from: op.pos, insert: op.text })
      }
    }

    view.dispatch({
      changes: changes as any,
    })
  }, [])

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
    leftRef,
    rightRef,
    cleanup,
    setEditors,
    replaceOpponentContent,
    applyDelta,
    changesToDelta,
    getPlayerContent,
  }
}