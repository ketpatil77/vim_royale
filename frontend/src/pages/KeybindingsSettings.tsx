import { getCM } from '@replit/codemirror-vim'
import { EditorView } from '@codemirror/view'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditorPanel } from '../components/EditorPanel/EditorPanel'
import { TerminalLayout } from '../components/TerminalLayout/TerminalLayout'
import { useCRT } from '../contexts/CRTContext'
import { useKeybindings } from '../contexts/KeybindingsContext'
import { applyVimKeybindings, mappingToCommand, normalizeMappings, parseVimKeybindingSource } from '../keybindings/vimKeybindings'
import { createEditorState } from './typingChallenge/editorState'
import { formatVimMode } from './typingChallenge/vimMode'
import './KeybindingsSettings.css'

const PREVIEW_EDITOR_SOURCE = `function previewKeybindings(value) {
  const lines = value.split("\\n")
  return lines.filter(Boolean).length
}

const sample = "jj -> <Esc>"
console.log(previewKeybindings(sample))
`

export default function KeybindingsSettings() {
  const navigate = useNavigate()
  const { crtEnabled, toggleCrt } = useCRT()
  const { mappings, warnings, isLoading, saveFromSource, clearAll, isAuthenticated } = useKeybindings()
  const [source, setSource] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'ok' | 'error' | 'info'>('info')
  const [isSaving, setIsSaving] = useState(false)
  const [isTemporaryPreviewApplied, setIsTemporaryPreviewApplied] = useState(false)
  const [previewVimMode, setPreviewVimMode] = useState('NORMAL')
  const [uploadedFileName, setUploadedFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewMountRef = useRef<HTMLDivElement | null>(null)
  const previewViewRef = useRef<EditorView | null>(null)

  const currentMappingsSource = useMemo(() => {
    if (!mappings.length) return ''
    return mappings.map(mappingToCommand).join('\n')
  }, [mappings])

  const parsePreview = useMemo(() => parseVimKeybindingSource(source), [source])

  useEffect(() => {
    if (isLoading) return
    if (!previewMountRef.current) return
    if (previewViewRef.current) return

    const view = new EditorView({
      state: createEditorState({
        content: PREVIEW_EDITOR_SOURCE,
        readOnly: false,
      }),
      parent: previewMountRef.current,
    })
    previewViewRef.current = view
    view.focus()

    const cm = getCM(view)
    const handleVimModeChange = (event: { mode?: string; subMode?: string }) => {
      setPreviewVimMode(formatVimMode(event.mode, event.subMode))
    }

    cm?.on('vim-mode-change', handleVimModeChange)
    setPreviewVimMode('NORMAL')

    return () => {
      cm?.off('vim-mode-change', handleVimModeChange)
      if (previewViewRef.current === view) {
        previewViewRef.current = null
      }
      view.destroy()
    }
  }, [isLoading])

  useEffect(() => {
    return () => {
      if (isTemporaryPreviewApplied) {
        applyVimKeybindings(mappings)
      }
    }
  }, [isTemporaryPreviewApplied, mappings])

  const applyPreviewMappings = () => {
    const parsed = parseVimKeybindingSource(source)
    const normalized = normalizeMappings(parsed.mappings)
    const previewWarnings = [...parsed.warnings, ...normalized.warnings]

    applyVimKeybindings(normalized.mappings)
    setIsTemporaryPreviewApplied(true)

    if (previewWarnings.length > 0) {
      setStatusType('info')
      setStatusMessage(`Preview applied with ${previewWarnings.length} warning(s).`)
    } else {
      setStatusType('ok')
      setStatusMessage(`Preview applied with ${normalized.mappings.length} mapping(s).`)
    }

    previewViewRef.current?.focus()
  }

  const revertPreviewMappings = () => {
    applyVimKeybindings(mappings)
    setIsTemporaryPreviewApplied(false)
    setStatusType('info')
    setStatusMessage('Preview reverted to saved/session keybindings.')
    previewViewRef.current?.focus()
  }

  const handleSave = async () => {
    setIsSaving(true)
    setStatusMessage('')
    try {
      const response = await saveFromSource(source)
      setIsTemporaryPreviewApplied(false)
      if (response.warnings.length > 0) {
        setStatusType('info')
        setStatusMessage(`Saved ${response.mappings.length} mappings with ${response.warnings.length} warning(s).`)
      } else {
        setStatusType('ok')
        setStatusMessage(`Saved ${response.mappings.length} mapping(s).`)
      }
    } catch {
      setStatusType('error')
      setStatusMessage('Failed to save keybindings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = async () => {
    setIsSaving(true)
    setStatusMessage('')
    try {
      await clearAll()
      setSource('')
      setIsTemporaryPreviewApplied(false)
      setStatusType('ok')
      setStatusMessage('Keybindings cleared.')
    } catch {
      setStatusType('error')
      setStatusMessage('Failed to clear keybindings.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePickFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      setSource(text)
      setUploadedFileName(file.name)
      setStatusType('info')
      setStatusMessage(`Loaded ${file.name}. Review preview, then save.`)
    } catch {
      setStatusType('error')
      setStatusMessage('Failed to read file.')
    } finally {
      event.target.value = ''
    }
  }

  const resetPreviewEditor = () => {
    const view = previewViewRef.current
    if (!view) return

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: PREVIEW_EDITOR_SOURCE,
      },
      selection: { anchor: 0 },
      scrollIntoView: true,
    })
    view.focus()
  }

  if (isLoading) {
    return (
      <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
        <main className="keybindings-main">
          <div className="keybindings-loading">Loading keybindings...</div>
        </main>
      </TerminalLayout>
    )
  }

  return (
    <TerminalLayout crtEnabled={crtEnabled} onCrtToggle={toggleCrt}>
      <main className="keybindings-main">
        <section className="keybindings-header">
          <h1>Vim Keybindings</h1>
          <p>
            {isAuthenticated
              ? 'Preview mappings first, then save them to your account if they feel right.'
              : 'Preview mappings first in this session, then apply them when ready. Log in to persist.'}
          </p>
          <div className="keybindings-header-actions">
            <button type="button" className="keybindings-btn" onClick={() => navigate(-1)}>
              Back
            </button>
            <button
              type="button"
              className="keybindings-btn keybindings-btn--secondary"
              onClick={() => setSource(currentMappingsSource)}
            >
              Load Current
            </button>
          </div>
        </section>

        <section className="keybindings-editor">
          <label htmlFor="keybinding-source">Import Mapping Lines</label>
          <div className="keybindings-upload-row">
            <button
              type="button"
              className="keybindings-btn"
              onClick={handlePickFile}
              disabled={isSaving}
            >
              Upload .vimrc/.txt
            </button>
            <span className="keybindings-upload-name">
              {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'No file uploaded'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              className="keybindings-file-input"
              accept=".vimrc,.vim,.txt,text/plain"
              onChange={handleFileUpload}
            />
          </div>
          <textarea
            id="keybinding-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={`nnoremap Y y$\ninoremap jj <Esc>\nunmap Q`}
          />
          {parsePreview.warnings.length > 0 && (
            <div className="keybindings-inline-warnings">
              {parsePreview.warnings.map((warning, index) => (
                <p key={`${warning.line}-${index}`}>
                  Line {warning.line}: {warning.message}
                </p>
              ))}
            </div>
          )}
          <div className="keybindings-actions">
            <button
              type="button"
              className="keybindings-btn keybindings-btn--primary"
              onClick={applyPreviewMappings}
              disabled={isSaving}
            >
              Preview Only
            </button>
            <button
              type="button"
              className="keybindings-btn keybindings-btn--secondary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isAuthenticated ? 'Save to Account' : 'Apply for Session'}
            </button>
            <button
              type="button"
              className="keybindings-btn"
              onClick={revertPreviewMappings}
              disabled={isSaving || !isTemporaryPreviewApplied}
            >
              Revert Preview
            </button>
            <button
              type="button"
              className="keybindings-btn keybindings-btn--danger"
              onClick={handleClear}
              disabled={isSaving}
            >
              Clear All
            </button>
          </div>
          {statusMessage ? (
            <p className={`keybindings-status keybindings-status--${statusType}`}>{statusMessage}</p>
          ) : null}
        </section>

        <section className="keybindings-preview">
          <div className="keybindings-preview-header">
            <h2>Live Vim Preview</h2>
            <button
              type="button"
              className="keybindings-btn keybindings-btn--secondary"
              onClick={resetPreviewEditor}
            >
              Reset Preview
            </button>
          </div>
          <p>Use this editor to test mappings currently in effect before saving.</p>
          <div className="keybindings-hud">
            <div className="keybindings-hud-metrics">
              <span className="keybindings-hud-pill">
                parsed mappings: <b>{parsePreview.mappings.length}</b>
              </span>
              <span className="keybindings-hud-pill">
                parse warnings: <b>{parsePreview.warnings.length}</b>
              </span>
              <span className="keybindings-hud-pill">
                saved mappings: <b>{mappings.length}</b>
              </span>
              <span className="keybindings-hud-pill">
                server warnings: <b>{warnings.length}</b>
              </span>
            </div>
          </div>
          <div className="keybindings-live-editor">
            <EditorPanel
              filename="preview.js"
              panelTitle="KEYBINDING PREVIEW"
              displayName="vim-preview"
              vimMode={previewVimMode}
              rating={1500}
              ref={previewMountRef}
            />
          </div>
        </section>
      </main>
    </TerminalLayout>
  )
}
