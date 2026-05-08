import { WS_URL, PLAYER_ID_SESSION_KEY, PLAYER_ID_STORAGE_KEY } from '../../config'

export function createPlayerId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16)
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getOrCreatePlayerId(forceNew = false): string {
  if (!forceNew) {
    const sessionId = sessionStorage.getItem(PLAYER_ID_SESSION_KEY)
    if (sessionId) return sessionId
  }

  const created = createPlayerId()
  sessionStorage.setItem(PLAYER_ID_SESSION_KEY, created)
  localStorage.setItem(PLAYER_ID_STORAGE_KEY, created)
  return created
}

export { WS_URL }