export function formatVimMode(mode?: string, subMode?: string): string {
  const base = (mode ?? 'normal').toLowerCase()
  if (base === 'visual' && subMode === 'blockwise') return 'VISUAL BLOCK'
  if (base === 'visual' && subMode === 'linewise') return 'VISUAL LINE'
  return base.toUpperCase()
}
