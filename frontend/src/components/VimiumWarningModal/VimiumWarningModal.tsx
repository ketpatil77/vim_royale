import { useCallback, useEffect, useState } from 'react'
import './VimiumWarningModal.css'

const DETECTION_SELECTORS = [
  '.vimiumReset',
  '.internalVimiumHintMarker',
  '.vimiumHintMarker',
  '.vimiumHintMarkerContainer',
  '#vimiumHintMarkerContainer',
  '#vimiumUIComponent',
  '#vimiumHelpDialogContainer',
  '#vimiumHUD',
  '#vomnibarPage',
  'iframe[src*="chrome-extension://dbepggeogbaibhgnhhndojpepiihcmeb"]',
  'iframe[src*="chrome-extension://hfjbmagddngcpeloejdejnfgbamkjaeg"]',
  'iframe[src*="moz-extension://"][src*="vimium"]',
]

const STYLE_HINTS = [
  '.vimiumReset',
  'internalVimiumHintMarker',
  'vimiumHintMarkerContainer',
  '#vimiumHintMarkerContainer',
  'vimiumUIComponent',
  '#vimiumHUD',
  '#vimiumHelpDialogContainer',
  'vomnibar',
]

const POLL_MS = 1000
const INTRO_SEEN_STORAGE_KEY = 'vim_royale_vimium_warning_seen_v1'
const KNOWN_EXTENSION_IDS = [
  'dbepggeogbaibhgnhhndojpepiihcmeb', // Vimium
  'hfjbmagddngcpeloejdejnfgbamkjaeg', // Vimium C
]

const EXTENSION_URL_REGEX = /^(?:chrome|moz)-extension:\/\/[^/]+\/.+$/i
const VIMIUM_PATH_HINTS = /(vimium|vomnibar|hud|help_dialog)/i

const hasLikelyVimiumUrl = (value: string): boolean => {
  if (!EXTENSION_URL_REGEX.test(value)) return false
  if (KNOWN_EXTENSION_IDS.some((id) => value.includes(`://${id}/`))) return true
  return VIMIUM_PATH_HINTS.test(value)
}

const detectVimium = (): boolean => {
  if (typeof document === 'undefined') return false

  for (const selector of DETECTION_SELECTORS) {
    if (document.querySelector(selector)) {
      return true
    }
  }

  const embeddedNodes = document.querySelectorAll('iframe, script[src], link[href]')
  for (let i = 0; i < embeddedNodes.length; i += 1) {
    const node = embeddedNodes[i]
    const url = node.getAttribute('src') || node.getAttribute('href')
    if (url && hasLikelyVimiumUrl(url)) {
      return true
    }
  }

  const styles = document.querySelectorAll('style')
  for (let i = 0; i < styles.length; i += 1) {
    const styleTag = styles[i]
    const text = styleTag.textContent || ''
    if (STYLE_HINTS.some((hint) => text.includes(hint))) {
      return true
    }
  }

  for (const styleSheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = styleSheet.cssRules
    } catch {
      continue
    }

    for (const rule of Array.from(rules)) {
      const cssText = rule.cssText || ''
      if (STYLE_HINTS.some((hint) => cssText.includes(hint))) {
        return true
      }
    }
  }

  return false
}

export function VimiumWarningModal() {
  const [isVimiumDetected, setIsVimiumDetected] = useState(false)
  const [showIntroNotice, setShowIntroNotice] = useState(false)

  const readIntroSeen = () => {
    try {
      return window.localStorage.getItem(INTRO_SEEN_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  }

  const markIntroSeen = () => {
    try {
      window.localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1')
    } catch {
      // noop: localStorage can be unavailable in some privacy modes.
    }
  }

  const refreshDetection = useCallback(() => {
    setIsVimiumDetected(detectVimium())
  }, [])

  useEffect(() => {
    const hasSeenIntro = readIntroSeen()
    if (!hasSeenIntro) {
      setShowIntroNotice(true)
      markIntroSeen()
    }

    refreshDetection()

    const observer = new MutationObserver(() => {
      refreshDetection()
    })

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    const interval = window.setInterval(refreshDetection, POLL_MS)
    const onFocus = () => refreshDetection()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshDetection()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      observer.disconnect()
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshDetection])

  const showModal = isVimiumDetected || showIntroNotice
  const isBlockingWarning = isVimiumDetected

  if (!showModal) {
    return null
  }

  return (
    <div className="vimium-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="vimium-modal-title">
      <div className="vimium-modal">
        <div className="vimium-modal-titlebar">
          <span className="vimium-modal-titlebar-colon">:</span>
          <span>vimium-warning</span>
        </div>
        <div className="vimium-modal-body">
          <h2 id="vimium-modal-title">
            {isBlockingWarning ? 'Disable Vimium to continue' : 'Vimium warning'}
          </h2>
          {isBlockingWarning ? (
            <div>
            <p>
              Vimium appears to be enabled. Please disable it first, then return to this tab.
            </p>
            <button className="vimium-modal-btn vimium-modal-btn-secondary" onClick={() => setShowIntroNotice(false)}>
              Continue
            </button>
            </div>
          ) : (
            <p>
              If you use Vimium (or Vimium C), disable it before playing to avoid keybinding conflicts.
            </p>
          )}
          {!isBlockingWarning && (
            <button className="vimium-modal-btn vimium-modal-btn-secondary" onClick={() => setShowIntroNotice(false)}>
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
