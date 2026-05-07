package utils

import (
	"math/rand"
	"regexp"
	"strings"
)

var sampleTargetCodes = []string{
	`function sum(arr) {
  let total = 0
  for (let i = 0; i < arr.length; i++) {
    total += arr[i]
  }
  return total
}`,
	`function isPalindrome(text) {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  return cleaned === cleaned.split('').reverse().join('')
}`,
	`function fibonacci(n) {
  if (n <= 1) return n
  let a = 0
  let b = 1
  for (let i = 2; i <= n; i++) {
    const next = a + b
    a = b
    b = next
  }
  return b
}`,
	`function maxInArray(nums) {
  let best = nums[0]
  for (const value of nums) {
    if (value > best) {
      best = value
    }
  }
  return best
}`,
	`function countVowels(input) {
  const vowels = new Set(['a', 'e', 'i', 'o', 'u'])
  let total = 0
  for (const ch of input.toLowerCase()) {
    if (vowels.has(ch)) total++
  }
  return total
}`,
	`function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}`,
	`function uniqueValues(list) {
  const seen = new Set()
  for (const item of list) {
    seen.add(item)
  }
  return Array.from(seen)
}`,
	`function reverseWords(sentence) {
  return sentence
    .trim()
    .split(/\s+/)
    .reverse()
    .join(' ')
}`,
	`function mergeSorted(a, b) {
  const out = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] < b[j]) {
      out.push(a[i])
      i++
    } else {
      out.push(b[j])
      j++
    }
  }
  return out.concat(a.slice(i), b.slice(j))
}`,
	`function frequencyMap(words) {
  const counts = {}
  for (const word of words) {
    counts[word] = (counts[word] || 0) + 1
  }
  return counts
}`,
}

var eqWhitespacePattern = regexp.MustCompile(`\s*=\s*`)
var allWhitespacePattern = regexp.MustCompile(`\s+`)
var expandExpressionPattern = regexp.MustCompile(`(\w+)\s*\+=\s*(\d+)`)

func PickTargetCode() string {
	if len(sampleTargetCodes) == 0 {
		return ""
	}
	return sampleTargetCodes[rand.Intn(len(sampleTargetCodes))]
}

func PolluteCode(originalCode string) string {
	lines := strings.Split(originalCode, "\n")
	mutated := make([]string, len(lines))

	for i, line := range lines {
		newLine := line
		numTransforms := rand.Intn(2) + 1 
		for j := 0; j < numTransforms; j++ {
			switch rand.Intn(4) {
			case 0:
				newLine = distortWhitespace(newLine)
			case 1:
				newLine = addComment(newLine)
			case 2:
				newLine = wrapInBlock(newLine)
			default:
				newLine = expandExpression(newLine)
			}
		}
		mutated[i] = newLine
	}

	return strings.Join(mutated, "\n")
}

func distortWhitespace(line string) string {
	line = eqWhitespacePattern.ReplaceAllString(line, " = ")
	return allWhitespacePattern.ReplaceAllStringFunc(line, func(string) string {
		return strings.Repeat(" ", rand.Intn(3)+1)
	})
}

func addComment(line string) string {
	if strings.TrimSpace(line) == "" {
		return line
	}
	if rand.Float64() < 0.3 {
		return "// TODO: refactor\n" + line
	}
	return line
}

func wrapInBlock(line string) string {
	if rand.Float64() < 0.2 && strings.TrimSpace(line) != "" {
		return "if (true) {\n  " + line + "\n}"
	}
	return line
}

func expandExpression(line string) string {
	return expandExpressionPattern.ReplaceAllString(line, `${1} = ${1} + ${2}`)
}
