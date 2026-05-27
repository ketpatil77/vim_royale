import { Vim } from '@replit/codemirror-vim'

export const VIM_KEYBINDINGS_VERSION = 1
const GUEST_KEYBINDINGS_STORAGE_KEY = 'vim_royale_guest_vim_keybindings_v1'

export type VimMappingMode = 'all' | 'normal' | 'insert' | 'insertCommand' | 'visual' | 'operatorPending'

export type VimKeybindingMapping = {
  mode: VimMappingMode
  lhs: string
  rhs?: string
  noremap?: boolean
  unmap?: boolean
}

export type VimKeybindingWarning = {
  line: number
  content?: string
  message: string
}

export type VimKeybindingsResponse = {
  mappings: VimKeybindingMapping[]
  warnings: VimKeybindingWarning[]
  version: number
}

const COMMAND_SPECS: Record<string, { mode: VimMappingMode; noremap: boolean; unmap: boolean }> = {
  map: { mode: 'all', noremap: false, unmap: false },
  nmap: { mode: 'normal', noremap: false, unmap: false },
  imap: { mode: 'insert', noremap: false, unmap: false },
  vmap: { mode: 'visual', noremap: false, unmap: false },
  xmap: { mode: 'visual', noremap: false, unmap: false },
  smap: { mode: 'visual', noremap: false, unmap: false },
  omap: { mode: 'operatorPending', noremap: false, unmap: false },
  lmap: { mode: 'insertCommand', noremap: false, unmap: false },
  cmap: { mode: 'insertCommand', noremap: false, unmap: false },
  tmap: { mode: 'insertCommand', noremap: false, unmap: false },
  'map!': { mode: 'insertCommand', noremap: false, unmap: false },
  noremap: { mode: 'all', noremap: true, unmap: false },
  nnoremap: { mode: 'normal', noremap: true, unmap: false },
  inoremap: { mode: 'insert', noremap: true, unmap: false },
  vnoremap: { mode: 'visual', noremap: true, unmap: false },
  xnoremap: { mode: 'visual', noremap: true, unmap: false },
  snoremap: { mode: 'visual', noremap: true, unmap: false },
  onoremap: { mode: 'operatorPending', noremap: true, unmap: false },
  lnoremap: { mode: 'insertCommand', noremap: true, unmap: false },
  cnoremap: { mode: 'insertCommand', noremap: true, unmap: false },
  tnoremap: { mode: 'insertCommand', noremap: true, unmap: false },
  'noremap!': { mode: 'insertCommand', noremap: true, unmap: false },
  unmap: { mode: 'all', noremap: false, unmap: true },
  nunmap: { mode: 'normal', noremap: false, unmap: true },
  iunmap: { mode: 'insert', noremap: false, unmap: true },
  vunmap: { mode: 'visual', noremap: false, unmap: true },
  xunmap: { mode: 'visual', noremap: false, unmap: true },
  sunmap: { mode: 'visual', noremap: false, unmap: true },
  ounmap: { mode: 'operatorPending', noremap: false, unmap: true },
  lunmap: { mode: 'insertCommand', noremap: false, unmap: true },
  cunmap: { mode: 'insertCommand', noremap: false, unmap: true },
  tunmap: { mode: 'insertCommand', noremap: false, unmap: true },
  'unmap!': { mode: 'insertCommand', noremap: false, unmap: true },
}

const ALL_CONTEXTS: Array<'normal' | 'visual' | 'operatorPending'> = [
  'normal',
  'visual',
  'operatorPending',
]

function contextsForMode(mode: VimMappingMode): Array<'normal' | 'insert' | 'visual' | 'operatorPending'> {
  switch (mode) {
    case 'all':
      return ALL_CONTEXTS
    case 'insertCommand':
      return ['insert']
    case 'normal':
    case 'insert':
    case 'visual':
    case 'operatorPending':
      return [mode]
    default:
      return []
  }
}

function isSupportedMode(mode: string): mode is VimMappingMode {
  return mode === 'all' || mode === 'normal' || mode === 'insert' || mode === 'insertCommand' || mode === 'visual' || mode === 'operatorPending'
}

export function parseVimKeybindingSource(source: string): {
  mappings: VimKeybindingMapping[]
  warnings: VimKeybindingWarning[]
} {
  const mappings: VimKeybindingMapping[] = []
  const warnings: VimKeybindingWarning[] = []

  const lines = source.split('\n')
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1
    let line = rawLine.trim()

    if (!line || line.startsWith('"')) return
    if (line.startsWith(':')) line = line.slice(1).trim()

    const commandPart = consumeToken(line)
    if (!commandPart) return

    const command = commandPart.token.toLowerCase()
    const spec = COMMAND_SPECS[command]
    if (!spec) {
      warnings.push({
        line: lineNumber,
        content: rawLine,
        message: `Unsupported command "${commandPart.token}"`,
      })
      return
    }

    let remaining = commandPart.rest
    let lhsPart = consumeToken(remaining)
    while (lhsPart && isMapArgumentToken(lhsPart.token)) {
      remaining = lhsPart.rest
      lhsPart = consumeToken(remaining)
    }
    if (!lhsPart) {
      warnings.push({
        line: lineNumber,
        content: rawLine,
        message: 'Missing left-hand key sequence',
      })
      return
    }

    const lhs = lhsPart.token.trim()
    if (!lhs) {
      warnings.push({
        line: lineNumber,
        content: rawLine,
        message: 'Left-hand key sequence cannot be empty',
      })
      return
    }

    if (spec.unmap) {
      mappings.push({
        mode: spec.mode,
        lhs,
        unmap: true,
      })
      return
    }

    const rhs = trimLeadingHorizontalWhitespace(lhsPart.rest)
    if (!rhs.trim()) {
      warnings.push({
        line: lineNumber,
        content: rawLine,
        message: 'Missing right-hand key sequence',
      })
      return
    }

    mappings.push({
      mode: spec.mode,
      lhs,
      rhs,
      noremap: spec.noremap,
    })
  })

  return { mappings, warnings }
}

export function normalizeMappings(mappings: VimKeybindingMapping[]): {
  mappings: VimKeybindingMapping[]
  warnings: VimKeybindingWarning[]
} {
  const normalized: VimKeybindingMapping[] = []
  const warnings: VimKeybindingWarning[] = []

  mappings.forEach((mapping, index) => {
    const lineNumber = index + 1
    const modeCandidate = (mapping.mode || 'all').trim()

    if (!isSupportedMode(modeCandidate)) {
      warnings.push({
        line: lineNumber,
        message: `Unsupported mode "${mapping.mode}"`,
      })
      return
    }
    const mode = modeCandidate

    const lhs = mapping.lhs?.trim() || ''
    if (!lhs) {
      warnings.push({
        line: lineNumber,
        message: 'Left-hand key sequence cannot be empty',
      })
      return
    }

    if (mapping.unmap) {
      normalized.push({
        mode,
        lhs,
        unmap: true,
      })
      return
    }

    const rhs = mapping.rhs?.trim() || ''
    if (!rhs) {
      warnings.push({
        line: lineNumber,
        message: 'Right-hand key sequence cannot be empty',
      })
      return
    }

    normalized.push({
      mode,
      lhs,
      rhs: mapping.rhs || '',
      noremap: Boolean(mapping.noremap),
    })
  })

  return { mappings: normalized, warnings }
}

export function serializeMappings(mappings: VimKeybindingMapping[]): VimKeybindingMapping[] {
  return mappings.map((mapping) => ({
    mode: mapping.mode,
    lhs: mapping.lhs,
    rhs: mapping.rhs,
    noremap: Boolean(mapping.noremap),
    unmap: Boolean(mapping.unmap),
  }))
}

export function mappingToCommand(mapping: VimKeybindingMapping): string {
  if (mapping.unmap) {
    switch (mapping.mode) {
      case 'normal':
        return `nunmap ${mapping.lhs}`
      case 'insert':
        return `iunmap ${mapping.lhs}`
      case 'insertCommand':
        return `unmap! ${mapping.lhs}`
      case 'visual':
        return `vunmap ${mapping.lhs}`
      case 'operatorPending':
        return `ounmap ${mapping.lhs}`
      default:
        return `unmap ${mapping.lhs}`
    }
  }

  const rhs = mapping.rhs || ''
  if (mapping.noremap) {
    switch (mapping.mode) {
      case 'normal':
        return `nnoremap ${mapping.lhs} ${rhs}`
      case 'insert':
        return `inoremap ${mapping.lhs} ${rhs}`
      case 'insertCommand':
        return `noremap! ${mapping.lhs} ${rhs}`
      case 'visual':
        return `vnoremap ${mapping.lhs} ${rhs}`
      case 'operatorPending':
        return `onoremap ${mapping.lhs} ${rhs}`
      default:
        return `noremap ${mapping.lhs} ${rhs}`
    }
  }

  switch (mapping.mode) {
    case 'normal':
      return `nmap ${mapping.lhs} ${rhs}`
    case 'insert':
      return `imap ${mapping.lhs} ${rhs}`
    case 'insertCommand':
      return `map! ${mapping.lhs} ${rhs}`
    case 'visual':
      return `vmap ${mapping.lhs} ${rhs}`
    case 'operatorPending':
      return `omap ${mapping.lhs} ${rhs}`
    default:
      return `map ${mapping.lhs} ${rhs}`
  }
}

export function clearAppliedVimKeybindings() {
  Vim.mapclear()
}

export function applyVimKeybindings(mappings: VimKeybindingMapping[]) {
  clearAppliedVimKeybindings()

  for (const mapping of mappings) {
    const contexts = contextsForMode(mapping.mode)
    for (const context of contexts) {
      if (mapping.unmap) {
        Vim.unmap(mapping.lhs, context)
        continue
      }

      if (mapping.noremap) {
        Vim.noremap(mapping.lhs, mapping.rhs || '', context)
      } else {
        Vim.map(mapping.lhs, mapping.rhs || '', context)
      }
    }
  }
}

export function readGuestKeybindings(): VimKeybindingMapping[] {
  try {
    const raw = sessionStorage.getItem(GUEST_KEYBINDINGS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as VimKeybindingMapping[]
    if (!Array.isArray(parsed)) return []
    return normalizeMappings(parsed).mappings
  } catch {
    return []
  }
}

export function saveGuestKeybindings(mappings: VimKeybindingMapping[]) {
  sessionStorage.setItem(GUEST_KEYBINDINGS_STORAGE_KEY, JSON.stringify(serializeMappings(mappings)))
}

export function clearGuestKeybindings() {
  sessionStorage.removeItem(GUEST_KEYBINDINGS_STORAGE_KEY)
}

function isMapArgumentToken(token: string): boolean {
  const value = token.trim().toLowerCase()
  return value === '<buffer>' || value === '<nowait>' || value === '<silent>' || value === '<special>' || value === '<script>' || value === '<expr>' || value === '<unique>'
}

function trimLeadingHorizontalWhitespace(value: string): string {
  return value.replace(/^[ \t]+/, '')
}

function consumeToken(value: string): { token: string; rest: string } | null {
  const trimmed = trimLeadingHorizontalWhitespace(value)
  if (!trimmed) return null

  const boundary = trimmed.search(/[ \t]/)
  if (boundary === -1) {
    return { token: trimmed, rest: '' }
  }

  return {
    token: trimmed.slice(0, boundary),
    rest: trimmed.slice(boundary),
  }
}
