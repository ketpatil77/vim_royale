import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { API_URL } from '../config'
import { useAuth } from './AuthContext'
import {
  applyVimKeybindings,
  clearAppliedVimKeybindings,
  clearGuestKeybindings,
  normalizeMappings,
  parseVimKeybindingSource,
  readGuestKeybindings,
  saveGuestKeybindings,
  type VimKeybindingMapping,
  type VimKeybindingWarning,
  type VimKeybindingsResponse,
} from '../keybindings/vimKeybindings'

type KeybindingsContextValue = {
  mappings: VimKeybindingMapping[]
  warnings: VimKeybindingWarning[]
  isLoading: boolean
  saveFromSource: (source: string) => Promise<VimKeybindingsResponse>
  clearAll: () => Promise<void>
  refresh: () => Promise<void>
  isAuthenticated: boolean
}

const KeybindingsContext = createContext<KeybindingsContextValue | null>(null)

async function fetchUserKeybindings(): Promise<VimKeybindingsResponse> {
  const response = await fetch(`${API_URL}/auth/me/keybindings`, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('Failed to fetch keybindings')
  }
  return response.json() as Promise<VimKeybindingsResponse>
}

async function patchUserKeybindings(body: { source?: string; mappings?: VimKeybindingMapping[] }): Promise<VimKeybindingsResponse> {
  const response = await fetch(`${API_URL}/auth/me/keybindings`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error('Failed to save keybindings')
  }

  return response.json() as Promise<VimKeybindingsResponse>
}

export function KeybindingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [mappings, setMappings] = useState<VimKeybindingMapping[]>([])
  const [warnings, setWarnings] = useState<VimKeybindingWarning[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const guestMergeAttemptedRef = useRef(false)

  const applyAndSet = useCallback((nextMappings: VimKeybindingMapping[], nextWarnings: VimKeybindingWarning[]) => {
    const normalized = normalizeMappings(nextMappings).mappings
    applyVimKeybindings(normalized)
    setMappings(normalized)
    setWarnings(nextWarnings)
  }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      const guestMappings = readGuestKeybindings()
      applyAndSet(guestMappings, [])
      setIsLoading(false)
      guestMergeAttemptedRef.current = false
      return
    }

    setIsLoading(true)
    try {
      const pendingGuestMappings = readGuestKeybindings()
      if (pendingGuestMappings.length > 0 && !guestMergeAttemptedRef.current) {
        guestMergeAttemptedRef.current = true
        try {
          await patchUserKeybindings({ mappings: pendingGuestMappings })
          clearGuestKeybindings()
        } catch {
          // Keep guest mappings in session storage and retry on next authenticated app load.
        }
      }

      const payload = await fetchUserKeybindings()
      applyAndSet(payload.mappings || [], payload.warnings || [])
    } catch {
      clearAppliedVimKeybindings()
      setMappings([])
      setWarnings([])
    } finally {
      setIsLoading(false)
    }
  }, [applyAndSet, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const saveFromSource = useCallback(
    async (source: string): Promise<VimKeybindingsResponse> => {
      if (!user) {
        const parsed = parseVimKeybindingSource(source)
        const normalized = normalizeMappings(parsed.mappings)
        const nextWarnings = [...parsed.warnings, ...normalized.warnings]
        if (source.trim() !== '' && normalized.mappings.length === 0) {
          throw new Error('No valid mappings found in source')
        }
        saveGuestKeybindings(normalized.mappings)
        applyAndSet(normalized.mappings, nextWarnings)
        return {
          mappings: normalized.mappings,
          warnings: nextWarnings,
          version: 1,
        }
      }

      const payload = await patchUserKeybindings({ source })
      applyAndSet(payload.mappings || [], payload.warnings || [])
      return payload
    },
    [applyAndSet, user]
  )

  const clearAll = useCallback(async () => {
    if (!user) {
      clearGuestKeybindings()
      applyAndSet([], [])
      return
    }

    const payload = await patchUserKeybindings({ mappings: [] })
    applyAndSet(payload.mappings || [], payload.warnings || [])
  }, [applyAndSet, user])

  const value = useMemo<KeybindingsContextValue>(
    () => ({
      mappings,
      warnings,
      isLoading,
      saveFromSource,
      clearAll,
      refresh,
      isAuthenticated: Boolean(user),
    }),
    [mappings, warnings, isLoading, saveFromSource, clearAll, refresh, user]
  )

  return <KeybindingsContext.Provider value={value}>{children}</KeybindingsContext.Provider>
}

export function useKeybindings() {
  const context = useContext(KeybindingsContext)
  if (!context) {
    throw new Error('useKeybindings must be used within KeybindingsProvider')
  }
  return context
}
