function distortWhitespace(line: string): string {
  return line
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s+/g, () => ' '.repeat(Math.floor(Math.random() * 3) + 1))
}

function addComment(line: string): string {
  if (line.trim() === '') return line
  if (Math.random() < 0.3) {
    return `// TODO: refactor\n${line}`
  }
  return line
}

function wrapInBlock(line: string): string {
  if (Math.random() < 0.2 && line.trim()) {
    return `if (true) {\n  ${line}\n}`
  }
  return line
}

function expandExpression(line: string): string {
  return line.replace(/(\w+)\s*\+=\s*(\d+)/, (_, variable: string, value: string) => {
    return `${variable} = ${variable} + ${value}`
  })
}

export function polluteCode(originalCode: string): string {
  const lines = originalCode.split('\n')
  const transformations = [
    distortWhitespace,
    addComment,
    wrapInBlock,
    expandExpression,
  ]

  const mutatedLines = lines.map((line) => {
    let newLine = line
    const numTransforms = Math.floor(Math.random() * 2) + 1
    for (let i = 0; i < numTransforms; i++) {
      const transform =
        transformations[Math.floor(Math.random() * transformations.length)]
      newLine = transform(newLine)
    }
    return newLine
  })

  return mutatedLines.join('\n')
}
