import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, drawSelection, keymap, lineNumbers } from '@codemirror/view'
import { vim } from '@replit/codemirror-vim'

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '15px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
    padding: '8px 0',
    textAlign: 'left',
  },
  '.cm-gutters': {
    backgroundColor: '#0d1117',
    borderRight: '1px solid #1f2937',
    color: '#6b7280',
  },
  '.cm-line': {
    paddingLeft: '12px',
  },
  '.cm-cursor': {
    borderLeftWidth: '2px',
    borderLeftColor: '#f59e0b',
  },
  '.cm-content.cm-focused': {
    outline: 'none',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(245, 158, 11, 0.24)',
  },
})

type CreateEditorStateArgs = {
  content: string
  readOnly: boolean
  onDocChanged?: () => void
}

export function createEditorState({
  content,
  readOnly,
  onDocChanged,
}: CreateEditorStateArgs): EditorState {
  const editableKeymap = [
    ...closeBracketsKeymap,
    indentWithTab,
    ...defaultKeymap,
    ...historyKeymap,
  ]

  const extensions: Extension[] = [
    ...(!readOnly ? [vim(), closeBrackets()] : []),
    history(),
    lineNumbers(),
    javascript({ jsx: true }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    oneDark,
    editorTheme,
    drawSelection(),
    EditorView.editable.of(!readOnly),
    EditorState.readOnly.of(readOnly),
    keymap.of(readOnly ? [] : editableKeymap),
  ]

  if (onDocChanged) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onDocChanged()
      })
    )
  }

  return EditorState.create({
    doc: content,
    extensions,
  })
}
