export type ReplayKeyMeta = {
  keyRaw: string
  keyDisplay: string
}

function withModifiers(prefix: string[], base: string): string {
  if (!prefix.length) return base.length === 1 ? base : `<${base}>`
  return `<${prefix.join('-')}-${base}>`
}

export function keyboardEventToReplayKeyMeta(event: KeyboardEvent): ReplayKeyMeta {
  const modifiers: string[] = []

  if (event.ctrlKey) modifiers.push('C')
  if (event.altKey) modifiers.push('A')
  if (event.metaKey) modifiers.push('M')
  if (event.shiftKey && event.key.length !== 1) modifiers.push('S')

  const key = event.key
  const namedKeyMap: Record<string, string> = {
    Escape: 'Esc',
    Enter: 'CR',
    Tab: 'Tab',
    Backspace: 'BS',
    Delete: 'Del',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ' ': 'Space',
  }

  const normalizedBase = namedKeyMap[key] || key
  const keyRaw = withModifiers(modifiers, normalizedBase)

  return {
    keyRaw,
    keyDisplay: replayKeyDisplayLabel(keyRaw),
  }
}

export function replayKeyDisplayLabel(keyRaw?: string, fallback = 'unknown'): string {
  if (!keyRaw) return fallback

  const map: Record<string, string> = {
    'Esc': 'Esc',
    'CR': 'Enter',
    'BS': 'Backspace',
    'Space': 'Space',
    'Tab': 'Tab',
    'Del': 'Delete',
    'Left': 'Left',
    'Right': 'Right',
    'Up': 'Up',
    'Down': 'Down',
    '<Esc>': 'Esc',
    '<C-[>': 'Esc',
    '<CR>': 'Enter',
    '<BS>': 'Backspace',
    '<Space>': 'Space',
    '<Tab>': 'Tab',
    '<Del>': 'Delete',
    '<Left>': 'Left',
    '<Right>': 'Right',
    '<Up>': 'Up',
    '<Down>': 'Down',
  }

  if (map[keyRaw]) return map[keyRaw]

  const wrapped = /^<(.+)>$/.exec(keyRaw)
  if (!wrapped) return keyRaw

  const modifierMap: Record<string, string> = {
    C: 'Ctrl',
    A: 'Alt',
    M: 'Meta',
    S: 'Shift',
  }
  let inner = wrapped[1]
  const modifierParts: string[] = []

  while (inner.length >= 2 && inner[1] === '-' && modifierMap[inner[0]]) {
    modifierParts.push(inner[0])
    inner = inner.slice(2)
  }

  if (!modifierParts.length) {
    return map[inner] || inner
  }

  const base = inner
  const displayMods = modifierParts.map((part) => modifierMap[part] || part)
  const displayBase = map[base] || base
  return `${displayMods.join('+')}+${displayBase}`
}
