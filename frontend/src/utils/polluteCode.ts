import type { Difficulty } from './challenges'

type commentVerbosity = 'explicit' | 'hint' | 'none'

interface PollutionConfig {
  maxMutationsPerLine: number
  verbosity: commentVerbosity
  enabledTransforms: number[]
}

const difficultyConfigs: Record<Difficulty, PollutionConfig> = {
  beginner: {
    maxMutationsPerLine: 1,
    verbosity: 'explicit',
    enabledTransforms: [0, 1, 3, 6, 9],
  },
  intermediate: {
    maxMutationsPerLine: 2,
    verbosity: 'hint',
    enabledTransforms: [0, 1, 2, 3, 4, 5, 6, 9, 10],
  },
  advanced: {
    maxMutationsPerLine: 3,
    verbosity: 'none',
    enabledTransforms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
  expert: {
    maxMutationsPerLine: 4,
    verbosity: 'none',
    enabledTransforms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
}

function leadingSpaces(line: string): string {
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch !== ' ' && ch !== '\t') {
      return line.slice(0, i)
    }
  }
  return ''
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function appendInlineComment(line: string, comment: string): string {
  const idx = line.indexOf('\n')
  if (idx === -1) {
    return line + ' // ' + comment
  }
  return line.slice(0, idx) + ' // ' + comment + line.slice(idx)
}

// ─── Transform Functions ─────────────────────────────────────────────────────

function transformSingleCharOp(line: string): [string, string, string] {
  const swaps = [
    { from: '+', to: '-', fix: 'the operator should be `+`' },
    { from: '-', to: '+', fix: 'the operator should be `-`' },
    { from: '<', to: '>', fix: 'the comparator should be `<`' },
    { from: '>', to: '<', fix: 'the comparator should be `>`' },
    { from: '!', to: '=', fix: 'the operator should be `!=`' },
  ]
  shuffle(swaps)
  for (const s of swaps) {
    const re = new RegExp(`(?:[\\s(])${escapeRegex(s.from)}(?:[\\s)])`)
    if (re.test(line)) {
      const changed = line.replace(re, m => m.replace(s.from, s.to))
      if (changed !== line) {
        return [changed, 'r', s.fix]
      }
    }
  }
  return [line, '', '']
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function transformExtraChar(line: string): [string, string, string] {
  const words = /\b[a-zA-Z]{4,}\b/
  const match = words.exec(line)
  if (!match) return [line, '', '']
  const [start, end] = match.index !== undefined ? [match.index, match.index + match[0].length] : [match.index!, match.index! + match[0].length]
  const word = line.slice(start, end)
  if (word.length < 3) return [line, '', '']
  const pos = Math.floor(Math.random() * (word.length - 2)) + 1
  const doubled = word.slice(0, pos) + word[pos] + word.slice(pos)
  return [line.slice(0, start) + doubled + line.slice(end), 'x', `\`${doubled}\` should be \`${word}\``]
}

function transformWrongKeyword(line: string): [string, string, string] {
  const swaps = [
    { from: 'const', to: 'let', fix: '`let` should be `const`' },
    { from: 'let', to: 'var', fix: '`var` should be `let`' },
    { from: 'return', to: 'continue', fix: '`continue` should be `return`' },
    { from: 'break', to: 'continue', fix: '`continue` should be `break`' },
    { from: 'true', to: 'false', fix: '`false` should be `true`' },
    { from: 'false', to: 'true', fix: '`true` should be `false`' },
    { from: 'push', to: 'pop', fix: '`pop` should be `push`' },
    { from: 'shift', to: 'unshift', fix: '`unshift` should be `shift`' },
    { from: 'map', to: 'forEach', fix: '`forEach` should be `map`' },
    { from: 'filter', to: 'find', fix: '`find` should be `filter`' },
    { from: 'async', to: 'sync', fix: '`sync` should be `async`' },
    { from: 'await', to: 'async', fix: '`async` should be `await`' },
  ]
  shuffle(swaps)
  for (const s of swaps) {
    const re = new RegExp(`\\b${escapeRegex(s.from)}\\b`)
    if (re.test(line)) {
      return [line.replace(re, s.to), 'ciw', s.fix]
    }
  }
  return [line, '', '']
}

function transformMisplacedSemicolon(line: string): [string, string, string] {
  const trimmed = line.trim()
  if (trimmed.endsWith('{') || trimmed.endsWith('}') || trimmed.endsWith(',') || trimmed === '') {
    return [line, '', '']
  }
  if (Math.random() < 0.5) {
    if (/;\s*$/.test(line)) {
      const changed = line.replace(/;\s*$/, '')
      return [changed, 'A', 'this line should end with `;`']
    }
  } else {
    const mid = Math.floor(line.length / 2)
    const idx = line.slice(mid).indexOf(' ')
    if (idx >= 0) {
      const pos = mid + idx
      return [line.slice(0, pos) + ';' + line.slice(pos), 'f;x', 'there should be no `;` in the middle of this line']
    }
  }
  return [line, '', '']
}

function transformWrongIndent(line: string): [string, string, string] {
  if (line.trim() === '') return [line, '', '']
  const indent = leadingSpaces(line)
  const content = line.slice(indent.length)
  const unit = '  '
  if (Math.random() < 0.5 && indent.length >= unit.length) {
    return [indent + unit + content, '<<', 'this line is indented too deeply']
  }
  if (indent.length >= unit.length) {
    return [indent.slice(unit.length) + content, '>>', 'this line is not indented enough']
  }
  return [line, '', '']
}

function transformDeadLine(line: string): [string, string, string] {
  if (Math.random() >= 0.3) return [line, '', '']
  const deadLines = ['var _unused = null;', "console.log('debug');", 'void 0;', 'undefined;', 'null;']
  const indent = leadingSpaces(line)
  const dead = indent + deadLines[Math.floor(Math.random() * deadLines.length)]
  return [dead + '\n' + line, 'dd', 'this line should not be there']
}

function transformJoinSplit(line: string): [string, string, string] {
  if (Math.random() >= 0.25) return [line, '', '']
  const trimmed = line.trim()
  const idx = trimmed.indexOf('(')
  if (idx < 0 || idx >= trimmed.length - 2) return [line, '', '']
  const indent = leadingSpaces(line)
  const split = indent + trimmed.slice(0, idx + 1) + '\n' + indent + '  ' + trimmed.slice(idx + 1)
  return [split, 'J', 'these two lines should be one']
}

function transformTrailingGarbage(line: string): [string, string, string] {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.endsWith('{') || trimmed.endsWith('}')) {
    return [line, '', '']
  }
  const junk = [' // noop', ' || null', " + ''", ' * 1', ' && true']
  const garbage = junk[Math.floor(Math.random() * junk.length)]
  return [line + garbage, 'd$', `the line should end before \`${garbage.trim()}\``]
}

function transformQuoteStyle(line: string): [string, string, string] {
  const doubleRe = /"[^"]*"/
  if (doubleRe.test(line) && Math.random() < 0.5) {
    const changed = line.replace(doubleRe, m => "'" + m.slice(1, -1) + "'")
    if (changed !== line) {
      return [changed, `:s/'/"/g`, 'string literals should use double quotes']
    }
  }
  const singleRe = /'[^']*'/
  if (singleRe.test(line) && Math.random() < 0.5) {
    const changed = line.replace(singleRe, m => '"' + m.slice(1, -1) + '"')
    if (changed !== line) {
      return [changed, `:s/"/'/g`, 'string literals should use single quotes']
    }
  }
  return [line, '', '']
}

function transformOffByOne(line: string): [string, string, string] {
  const numRe = /\b(\d+)\b/
  const match = numRe.exec(line)
  if (!match) return [line, '', '']
  const [start, end] = [match.index!, match.index! + match[0].length]
  const n = parseInt(match[0], 10)
  if (n < 0 || n > 99) return [line, '', '']
  let wrong: number
  if (Math.random() < 0.5) {
    wrong = n + 1
  } else {
    wrong = n - 1
  }
  if (wrong < 0) wrong = n + 1
  return [line.slice(0, start) + wrong + line.slice(end), 'r', `the value here should be \`${n}\`, not \`${wrong}\``]
}

function transformOperatorExpansion(line: string): [string, string, string] {
  const candidates: { re: RegExp; repl: string; fix: string }[] = [
    { re: /(\w+)\s*\+=\s*(\w+)/, repl: '$1 = $1 + $2', fix: 'this should use `+=`' },
    { re: /(\w+)\s*-=\s*(\w+)/, repl: '$1 = $1 - $2', fix: 'this should use `-=`' },
    { re: /(\w+)\s*\*=\s*(\w+)/, repl: '$1 = $1 * $2', fix: 'this should use `*=`' },
    { re: /\b(\w+)\+\+/, repl: '$1 = $1 + 1', fix: 'this should use `++`' },
    { re: /\b(\w+)--/, repl: '$1 = $1 - 1', fix: 'this should use `--`' },
  ]
  shuffle(candidates)
  for (const c of candidates) {
    if (c.re.test(line)) {
      return [line.replace(c.re, c.repl), 'cw', c.fix]
    }
  }
  return [line, '', '']
}

function transformSwapArgs(line: string): [string, string, string] {
  const re = /(\w+)\((\w+),\s*(\w+)/
  if (!re.test(line)) return [line, '', '']
  const changed = line.replace(re, '$1($3, $2')
  if (changed === line) return [line, '', '']
  const m = line.match(re)
  if (!m) return [changed, 'd/,<cr>P', 'arguments should be swapped']
  return [changed, 'd/,<cr>P', `\`${m[2]}\` should be the first argument, \`${m[3]}\` the second`]
}

function transformDuplicateWord(line: string): [string, string, string] {
  const words = /\b([a-zA-Z_]\w{2,})\b/g
  const matches: [number, number][] = []
  let match: RegExpExecArray | null
  while ((match = words.exec(line)) !== null) {
    matches.push([match.index, match.index + match[0].length])
  }
  if (matches.length < 2) return [line, '', '']
  const i = Math.floor(Math.random() * (matches.length - 1))
  const [start, end] = matches[i]
  const word = line.slice(start, end)
  const insert = word + ' '
  const changed = line.slice(0, end) + ' ' + insert + line.slice(end)
  return [changed, 'dw', `\`${word}\` appears twice but should appear once`]
}

function transformBrokenChain(line: string): [string, string, string] {
  const re = /(\w+\([^)]*\))\.\w+\([^)]*\)/
  if (!re.test(line)) return [line, '', '']
  const indent = leadingSpaces(line)
  const changed = line.replace(re, '$1\n' + indent + '  .$2')
  if (changed === line) return [line, '', '']
  return [changed, 'J', 'this chained call should be on a single line']
}

function transformWrongBoolean(line: string): [string, string, string] {
  if (/\btrue\b/.test(line) && Math.random() < 0.5) {
    return [line.replace(/\btrue\b/, 'false'), 'ciw', 'this value should be `true`']
  }
  if (/\bfalse\b/.test(line) && Math.random() < 0.5) {
    return [line.replace(/\bfalse\b/, 'true'), 'ciw', 'this value should be `false`']
  }
  return [line, '', '']
}

// ─── Transform Dispatch ─────────────────────────────────────────────────────

type TransformFn = (line: string) => [string, string, string]

const transforms: TransformFn[] = [
  transformSingleCharOp,
  transformExtraChar,
  transformWrongKeyword,
  transformMisplacedSemicolon,
  transformWrongIndent,
  transformDeadLine,
  transformJoinSplit,
  transformTrailingGarbage,
  transformQuoteStyle,
  transformOffByOne,
  transformOperatorExpansion,
  transformSwapArgs,
  transformDuplicateWord,
  transformBrokenChain,
  transformWrongBoolean,
]

function applyTransform(index: number, line: string): [string, string, string] {
  if (index < 0 || index >= transforms.length) {
    return [line, '', '']
  }
  return transforms[index](line)
}

// ─── Main Pollution Logic ────────────────────────────────────────────────────

function mutateLine(line: string, cfg: PollutionConfig, transformCounts: Record<number, number>): string {
  if (line.trim() === '') return line
  let current = line
  const shuffled = shuffle(cfg.enabledTransforms)
  const n = Math.floor(Math.random() * cfg.maxMutationsPerLine) + 1
  for (let i = 0; i < n && i < shuffled.length; i++) {
    const transformIdx = shuffled[i]
    if ((transformCounts[transformIdx] || 0) >= 3) continue
    const [changed, motion, instruction] = applyTransform(transformIdx, current)
    if (instruction !== '') {
      transformCounts[transformIdx] = (transformCounts[transformIdx] || 0) + 1
      if (cfg.verbosity === 'explicit') {
        current = appendInlineComment(changed, instruction)
      } else if (cfg.verbosity === 'hint') {
        current = appendInlineComment(changed, motion)
      } else {
        current = changed
      }
    } else {
      current = changed
    }
  }
  return current
}

export function polluteCode(originalCode: string, difficulty: Difficulty): string {
  const cfg = difficultyConfigs[difficulty]
  const lines = originalCode.split('\n')
  const transformCounts: Record<number, number> = {}
  const out: string[] = []
  for (const line of lines) {
    out.push(mutateLine(line, cfg, transformCounts))
  }
  return out.join('\n')
}

export function getPollutionConfig(difficulty: Difficulty): PollutionConfig {
  return difficultyConfigs[difficulty]
}