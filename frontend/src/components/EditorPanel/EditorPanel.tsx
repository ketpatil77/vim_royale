import { forwardRef } from 'react'
import './EditorPanel.css'

interface EditorPanelProps {
  filename: string
  panelTitle: string
  vimMode?: string
  className?: string
}

export const EditorPanel = forwardRef<HTMLDivElement, EditorPanelProps>(
  ({ filename, panelTitle, vimMode, className }, ref) => {
    return (
      <section className={`editor-panel ${className || ''}`}>
        <div className="editor-topbar">
          <div className="traffic-lights">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <div className="filename">{filename}</div>
        </div>
        <div className="panel-title">{panelTitle}</div>
        <div ref={ref} className="editor-mount" />
        {vimMode && <div className="vim-mode-badge">-- {vimMode} --</div>}
      </section>
    )
  }
)

EditorPanel.displayName = 'EditorPanel'