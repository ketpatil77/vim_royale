import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { API_URL } from '../config'

type GuestProfile = {
  guestId: string
  displayName: string
  sessionToken: string
  expiresAt: string
  createdAt: number
}

type GuestContextValue = {
  guest: GuestProfile | null
  ensureGuest: () => Promise<GuestProfile>
  clearGuest: () => void
}

const GUEST_STORAGE_KEY = 'vim_royale_guest_profile'

function readGuestFromStorage(): GuestProfile | null {
  try {
    const raw = sessionStorage.getItem(GUEST_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GuestProfile
    if (!parsed?.guestId || !parsed?.displayName || !parsed?.sessionToken || !parsed?.createdAt || !parsed?.expiresAt) return null
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

function writeGuestToStorage(profile: GuestProfile) {
  sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(profile))
}

const GuestContext = createContext<GuestContextValue | null>(null)

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const [guest, setGuest] = useState<GuestProfile | null>(() => readGuestFromStorage())

  const ensureGuest = useCallback(async (): Promise<GuestProfile> => {
    const existing = readGuestFromStorage()
    if (existing) {
      setGuest(existing)
      return existing
    }

    const response = await fetch(`${API_URL}/guest/session`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      throw new Error('failed to create guest session')
    }

    const payload = await response.json() as {
      guestId: string
      displayName: string
      sessionToken: string
      expiresAt: string
    }

    const created: GuestProfile = {
      guestId: payload.guestId,
      displayName: payload.displayName,
      sessionToken: payload.sessionToken,
      expiresAt: payload.expiresAt,
      createdAt: Date.now(),
    }
    writeGuestToStorage(created)
    setGuest(created)
    return created
  }, [])

  const clearGuest = useCallback(() => {
    sessionStorage.removeItem(GUEST_STORAGE_KEY)
    setGuest(null)
  }, [])

  const value = useMemo(
    () => ({
      guest,
      ensureGuest,
      clearGuest,
    }),
    [guest, ensureGuest, clearGuest]
  )

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>
}

export function useGuest() {
  const context = useContext(GuestContext)
  if (!context) {
    throw new Error('useGuest must be used within GuestProvider')
  }
  return context
}
