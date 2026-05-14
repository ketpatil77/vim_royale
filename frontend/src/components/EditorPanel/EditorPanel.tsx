import { forwardRef, useRef, useState, useEffect } from 'react'
import './EditorPanel.css'
import './EditorPanelToast.css'

interface EditorPanelProps {
  filename: string
  panelTitle: string
  vimMode?: string
  className?: string
  scrollWarningMessage?: string
  displayName?: string
  avatarUrl?: string
  rating?: number
}

export const EditorPanel = forwardRef<HTMLDivElement, EditorPanelProps>(
  ({ filename, vimMode, className, scrollWarningMessage, displayName, avatarUrl, rating }, ref) => {
    const [toastVisible, setToastVisible] = useState(false)
    const toastShownRef = useRef(false)
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      const element = ref as React.RefObject<HTMLDivElement>
      if (!element.current || !scrollWarningMessage) return

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault()
        
        if (!toastShownRef.current) {
          toastShownRef.current = true
          setToastVisible(true)

          if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current)
          }

          toastTimeoutRef.current = setTimeout(() => {
            setToastVisible(false)
          }, 3000)
        }
      }

      element.current.addEventListener('wheel', handleWheel, { passive: false })

      return () => {
        element.current?.removeEventListener('wheel', handleWheel)
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current)
        }
      }
    }, [ref, scrollWarningMessage])

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
        <div className="player-info-bar">
          <img
            src={avatarUrl || `https://github.com/identicons/github.png`}
            alt={displayName}
            className="player-info-avatar"
          />
          <span className="player-info-name">{displayName}</span>
          <span className="player-info-rating">{rating}</span>
        </div>
        <div ref={ref} className="editor-mount" />
        {vimMode && <div className="vim-mode-badge">-- {vimMode} --</div>}
        {toastVisible && (
          <div className={`editor-panel-toast ${toastVisible ? '' : 'fade-out'}`}>
            {scrollWarningMessage}
          </div>
        )}
      </section>
    )
  }
)

EditorPanel.displayName = 'EditorPanel'