package utils

import (
	"fmt"
	"math/rand"
	"regexp"
	"strings"
)

// ─── ELO Brackets ────────────────────────────────────────────────────────────

type difficultyTier int

const (
	tierBeginner     difficultyTier = iota // 0–799
	tierIntermediate                        // 800–1199
	tierAdvanced                            // 1200–1599
	tierExpert                              // 1600+
)

func tierFromElo(elo int) difficultyTier {
	switch {
	case elo < 800:
		return tierBeginner
	case elo < 1200:
		return tierIntermediate
	case elo < 1600:
		return tierAdvanced
	default:
		return tierExpert
	}
}

// ─── Difficulty Config ────────────────────────────────────────────────────────

type commentVerbosity int

const (
	verbosityExplicit commentVerbosity = iota // full hint: "use `ciw` to fix: ..."
	verbosityHint                             // motion only: "ciw"
	verbosityNone                             // no comment at all
)

type pollutionConfig struct {
	maxMutationsPerLine int
	verbosity           commentVerbosity
	noiseComments       bool  // inject unrelated // TODO noise
	enabledTransforms   []int // indices into the transform table
}

func configFromTier(tier difficultyTier) pollutionConfig {
	allTransforms := []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14}
	switch tier {
	case tierBeginner:
		return pollutionConfig{
			maxMutationsPerLine: 1,
			verbosity:           verbosityExplicit,
			noiseComments:       false,
			enabledTransforms:   []int{0, 1, 3, 6, 9},
		}
	case tierIntermediate:
		return pollutionConfig{
			maxMutationsPerLine: 2,
			verbosity:           verbosityHint,
			noiseComments:       false,
			enabledTransforms:   []int{0, 1, 2, 3, 4, 5, 6, 9, 10},
		}
	case tierAdvanced:
		return pollutionConfig{
			maxMutationsPerLine: 3,
			verbosity:           verbosityNone,
			noiseComments:       true,
			enabledTransforms:   allTransforms,
		}
	default: // expert
		return pollutionConfig{
			maxMutationsPerLine: 4,
			verbosity:           verbosityNone,
			noiseComments:       true,
			enabledTransforms:   allTransforms,
		}
	}
}

// ─── Regex ────────────────────────────────────────────────────────────────────

var (
	eqWhitespaceRe     = regexp.MustCompile(`\s*=\s*`)
	allWhitespaceRe    = regexp.MustCompile(`\s+`)
	expandExpressionRe = regexp.MustCompile(`(\w+)\s*\+=\s*(\w+)`)
	compoundSubtractRe = regexp.MustCompile(`(\w+)\s*-=\s*(\w+)`)
	compoundMultiplyRe = regexp.MustCompile(`(\w+)\s*\*=\s*(\w+)`)
	incrementRe        = regexp.MustCompile(`\b(\w+)\+\+`)
	decrementRe        = regexp.MustCompile(`\b(\w+)--`)
	strictEqRe         = regexp.MustCompile(`===`)
	strictNeqRe        = regexp.MustCompile(`!==`)
	arrowFnRe          = regexp.MustCompile(`\(([^)]*)\)\s*=>\s*`)
	constDeclRe        = regexp.MustCompile(`\bconst\b`)
	letDeclRe          = regexp.MustCompile(`\blet\b`)
	templateLiteralRe  = regexp.MustCompile("`([^`]*)`")
)

var (
	deadCodeVarRe    = regexp.MustCompile(`^\s*(const|let|var)\s+(\w+)\s*=`)
	ifElseRe         = regexp.MustCompile(`if\s*\(\s*(\w+)\s*\)\s*\{\s*return\s+([^}]+);\s*\}\s*else\s*\{\s*return\s+([^}]+);\s*\}`)
	numericLiteralRe = regexp.MustCompile(`\b(\d+)\b`)
	chainCallRe      = regexp.MustCompile(`(\w+)\.(\w+)\.(\w+)\(([^)]*)\)`)
	stringDoubleRe   = regexp.MustCompile(`"[^"]*"`)
	stringSingleRe   = regexp.MustCompile(`'[^']*'`)
	arrowFuncBlockRe = regexp.MustCompile(`=>\s*\{`)
	varDeclarationRe = regexp.MustCompile(`\b(const|let|var)\s+(\w+)\s*=\s*`)
	trailingSemiRe   = regexp.MustCompile(`;\s*$`)
	operatorRe       = regexp.MustCompile(`[+\-*/%&|^]=?|===?|!==?|[<>]=?|&&|\|\|`)
)

func PickTargetCode() string {
	if len(SampleTargetCodes) == 0 {
		return ""
	}
	return SampleTargetCodes[rand.Intn(len(SampleTargetCodes))]
}

func PolluteCode(originalCode string, elo int) string {
	cfg := configFromTier(tierFromElo(elo))
	lines := strings.Split(originalCode, "\n")
	out := make([]string, 0, len(lines)+1)
	out = append(out, "// remove all the comments after correcting the code")

	transformCounts := make(map[int]int)

	for _, line := range lines {
		mutated, comments := mutateLine(line, cfg, transformCounts)
		for _, c := range comments {
			out = append(out, c)
		}
		out = append(out, mutated)
	}

	return strings.Join(out, "\n")
}

func mutateLine(line string, cfg pollutionConfig, transformCounts map[int]int) (mutatedLine string, precedingComments []string) {
	if strings.TrimSpace(line) == "" {
		return line, nil
	}

	current := line
	var comments []string

	shuffled := make([]int, len(cfg.enabledTransforms))
	copy(shuffled, cfg.enabledTransforms)
	rand.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })

	n := rand.Intn(cfg.maxMutationsPerLine) + 1
	for i := 0; i < n && i < len(shuffled); i++ {
		transformIdx := shuffled[i]
		if transformCounts[transformIdx] >= 3 {
			continue
		}
		var motion, instruction string
		current, motion, instruction = applyTransform(transformIdx, current)
		if instruction != "" {
			transformCounts[transformIdx]++
			switch cfg.verbosity {
			case verbosityExplicit:
				comments = append(comments, fmt.Sprintf("// fix (%s): %s", motion, instruction))
			case verbosityHint:
				comments = append(comments, fmt.Sprintf("// %s", motion))
			}
		}
	}

	if cfg.noiseComments && rand.Float64() < 0.25 {
		comments = append(comments, pickNoiseComment())
	}

	return current, comments
}

// applyTransform returns (mutatedLine, vimMotion, humanInstruction).
// vimMotion is the primary Vim motion/command that fixes the introduced bug.
func applyTransform(index int, line string) (string, string, string) {
	transforms := []func(string) (string, string, string){
		transformSingleCharOp,       // 0  – r
		transformExtraChar,          // 1  – x
		transformWrongKeyword,       // 2  – ciw
		transformMisplacedSemicolon, // 3  – A / f;x
		transformWrongIndent,        // 4  – << / >>
		transformDeadLine,           // 5  – dd
		transformJoinSplit,          // 6  – J
		transformTrailingGarbage,    // 7  – d$
		transformQuoteStyle,         // 8  – :s
		transformOffByOne,           // 9  – r
		transformOperatorExpansion,  // 10 – cw
		transformSwapArgs,           // 11 – d/,<cr>P
		transformDuplicateWord,      // 12 – dw
		transformBrokenChain,        // 13 – J
		transformWrongBoolean,       // 14 – ciw
	}
	if index < 0 || index >= len(transforms) {
		return line, "", ""
	}
	return transforms[index](line)
}

// ─── Transforms ──────────────────────────────────────────────────────────────

// transformSingleCharOp replaces one character in an operator with a wrong one.
func transformSingleCharOp(line string) (string, string, string) {
	swaps := []struct{ from, to, fix string }{
		{"+", "-", "the operator should be `+`"},
		{"-", "+", "the operator should be `-`"},
		{"<", ">", "the comparator should be `<`"},
		{">", "<", "the comparator should be `>`"},
		{"!", "=", "the operator should be `!=`"},
	}
	rand.Shuffle(len(swaps), func(i, j int) { swaps[i], swaps[j] = swaps[j], swaps[i] })
	for _, s := range swaps {
		re := regexp.MustCompile(`(?:[\s(])` + regexp.QuoteMeta(s.from) + `(?:[\s)])`)
		if re.MatchString(line) {
			changed := re.ReplaceAllStringFunc(line, func(m string) string {
				return strings.Replace(m, s.from, s.to, 1)
			})
			if changed != line {
				return changed, "r", s.fix
			}
		}
	}
	return line, "", ""
}

// transformExtraChar inserts a duplicate character into an identifier or keyword.
func transformExtraChar(line string) (string, string, string) {
	words := regexp.MustCompile(`\b[a-zA-Z]{4,}\b`)
	match := words.FindStringIndex(line)
	if match == nil {
		return line, "", ""
	}
	start, end := match[0], match[1]
	word := line[start:end]
	pos := rand.Intn(len(word)-2) + 1
	doubled := word[:pos] + string(word[pos]) + word[pos:]
	return line[:start] + doubled + line[end:], "x", fmt.Sprintf("`%s` should be `%s`", doubled, word)
}

// transformWrongKeyword swaps a keyword for a similar but wrong one.
func transformWrongKeyword(line string) (string, string, string) {
	type swap struct{ from, to, fix string }
	swaps := []swap{
		{"const", "let", "`let` should be `const`"},
		{"let", "var", "`var` should be `let`"},
		{"return", "continue", "`continue` should be `return`"},
		{"break", "continue", "`continue` should be `break`"},
		{"true", "false", "`false` should be `true`"},
		{"false", "true", "`true` should be `false`"},
		{"push", "pop", "`pop` should be `push`"},
		{"shift", "unshift", "`unshift` should be `shift`"},
		{"map", "forEach", "`forEach` should be `map`"},
		{"filter", "find", "`find` should be `filter`"},
		{"async", "sync", "`sync` should be `async`"},
		{"await", "async", "`async` should be `await`"},
	}
	rand.Shuffle(len(swaps), func(i, j int) { swaps[i], swaps[j] = swaps[j], swaps[i] })
	for _, s := range swaps {
		re := regexp.MustCompile(`\b` + regexp.QuoteMeta(s.from) + `\b`)
		if re.MatchString(line) {
			return re.ReplaceAllString(line, s.to), "ciw", s.fix
		}
	}
	return line, "", ""
}

// transformMisplacedSemicolon either removes the trailing semicolon or inserts a stray one mid-line.
func transformMisplacedSemicolon(line string) (string, string, string) {
	trimmed := strings.TrimSpace(line)
	if strings.HasSuffix(trimmed, "{") || strings.HasSuffix(trimmed, "}") ||
		strings.HasSuffix(trimmed, ",") || trimmed == "" {
		return line, "", ""
	}

	if rand.Float64() < 0.5 {
		if trailingSemiRe.MatchString(line) {
			changed := trailingSemiRe.ReplaceAllString(line, "")
			return changed, "A", "this line should end with `;`"
		}
	} else {
		mid := len(line) / 2
		idx := strings.Index(line[mid:], " ")
		if idx >= 0 {
			pos := mid + idx
			changed := line[:pos] + ";" + line[pos:]
			return changed, "f;x", "there should be no `;` in the middle of this line"
		}
	}
	return line, "", ""
}

// transformWrongIndent shifts the line's indentation by one level in either direction.
func transformWrongIndent(line string) (string, string, string) {
	if strings.TrimSpace(line) == "" {
		return line, "", ""
	}
	indent := leadingSpaces(line)
	content := line[len(indent):]
	const unit = "  "
	if rand.Float64() < 0.5 && len(indent) >= len(unit) {
		return indent + unit + content, "<<", "this line is indented too deeply"
	}
	if len(indent) >= len(unit) {
		return indent[len(unit):] + content, ">>", "this line is not indented enough"
	}
	return line, "", ""
}

// transformDeadLine prepends a useless dead line of code.
func transformDeadLine(line string) (string, string, string) {
	if rand.Float64() >= 0.3 {
		return line, "", ""
	}
	deadLines := []string{
		"var _unused = null;",
		"console.log('debug');",
		"void 0;",
		"undefined;",
		"null;",
	}
	indent := leadingSpaces(line)
	dead := indent + deadLines[rand.Intn(len(deadLines))]
	return dead + "\n" + line, "dd", "the line above should not be there"
}

// transformJoinSplit breaks a short expression across two lines.
func transformJoinSplit(line string) (string, string, string) {
	if rand.Float64() >= 0.25 {
		return line, "", ""
	}
	trimmed := strings.TrimSpace(line)
	idx := strings.Index(trimmed, "(")
	if idx < 0 || idx >= len(trimmed)-2 {
		return line, "", ""
	}
	indent := leadingSpaces(line)
	split := indent + trimmed[:idx+1] + "\n" + indent + "  " + trimmed[idx+1:]
	return split, "J", "these two lines should be one"
}

// transformTrailingGarbage appends junk after the end of a valid statement.
func transformTrailingGarbage(line string) (string, string, string) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasSuffix(trimmed, "{") || strings.HasSuffix(trimmed, "}") {
		return line, "", ""
	}
	junk := []string{" // noop", " || null", " + ''", " * 1", " && true"}
	garbage := junk[rand.Intn(len(junk))]
	return line + garbage, "d$", fmt.Sprintf("the line should end before `%s`", strings.TrimSpace(garbage))
}

// transformQuoteStyle toggles double ↔ single quotes on a string literal.
func transformQuoteStyle(line string) (string, string, string) {
	if stringDoubleRe.MatchString(line) && rand.Float64() < 0.5 {
		changed := stringDoubleRe.ReplaceAllStringFunc(line, func(m string) string {
			return "'" + m[1:len(m)-1] + "'"
		})
		if changed != line {
			return changed, `:s/'/"/g`, "string literals should use double quotes"
		}
	}
	if stringSingleRe.MatchString(line) && rand.Float64() < 0.5 {
		changed := stringSingleRe.ReplaceAllStringFunc(line, func(m string) string {
			return "\"" + m[1:len(m)-1] + "\""
		})
		if changed != line {
			return changed, `:s/"/'/g`, "string literals should use single quotes"
		}
	}
	return line, "", ""
}

// transformOffByOne finds a small integer literal and nudges it by ±1.
func transformOffByOne(line string) (string, string, string) {
	match := numericLiteralRe.FindStringIndex(line)
	if match == nil {
		return line, "", ""
	}
	numStr := line[match[0]:match[1]]
	var n int
	fmt.Sscanf(numStr, "%d", &n)
	if n < 0 || n > 99 {
		return line, "", ""
	}
	var wrong int
	if rand.Float64() < 0.5 {
		wrong = n + 1
	} else {
		wrong = n - 1
	}
	if wrong < 0 {
		wrong = n + 1
	}
	changed := line[:match[0]] + fmt.Sprintf("%d", wrong) + line[match[1]:]
	return changed, "r", fmt.Sprintf("the value here should be `%d`, not `%d`", n, wrong)
}

// transformOperatorExpansion expands a compound assignment into its verbose form.
func transformOperatorExpansion(line string) (string, string, string) {
	type candidate struct {
		re          *regexp.Regexp
		repl        string
		instruction string
	}
	candidates := []candidate{
		{expandExpressionRe, "${1} = ${1} + ${2}", "this should use `+=`"},
		{compoundSubtractRe, "${1} = ${1} - ${2}", "this should use `-=`"},
		{compoundMultiplyRe, "${1} = ${1} * ${2}", "this should use `*=`"},
		{incrementRe, "${1} = ${1} + 1", "this should use `++`"},
		{decrementRe, "${1} = ${1} - 1", "this should use `--`"},
	}
	rand.Shuffle(len(candidates), func(i, j int) { candidates[i], candidates[j] = candidates[j], candidates[i] })
	for _, c := range candidates {
		if c.re.MatchString(line) {
			return c.re.ReplaceAllString(line, c.repl), "cw", c.instruction
		}
	}
	return line, "", ""
}

// transformSwapArgs reverses the first two comma-separated arguments in a call.
func transformSwapArgs(line string) (string, string, string) {
	re := regexp.MustCompile(`(\w+)\((\w+),\s*(\w+)`)
	if !re.MatchString(line) {
		return line, "", ""
	}
	changed := re.ReplaceAllString(line, "$1($3, $2")
	if changed == line {
		return line, "", ""
	}
	m := re.FindStringSubmatch(line)
	return changed, "d/,<cr>P", fmt.Sprintf("`%s` should be the first argument, `%s` the second", m[2], m[3])
}

// transformDuplicateWord repeats a word twice in succession.
func transformDuplicateWord(line string) (string, string, string) {
	words := regexp.MustCompile(`\b([a-zA-Z_]\w{2,})\b`)
	matches := words.FindAllStringIndex(line, -1)
	if len(matches) < 2 {
		return line, "", ""
	}
	i := rand.Intn(len(matches) - 1)
	m := matches[i]
	word := line[m[0]:m[1]]
	insert := word + " "
	changed := line[:m[1]] + " " + insert + line[m[1]:]
	return changed, "dw", fmt.Sprintf("`%s` appears twice but should appear once", word)
}

// transformBrokenChain splits a fluent method call onto two lines.
func transformBrokenChain(line string) (string, string, string) {
	re := regexp.MustCompile(`(\w+\([^)]*\))\.(` + `\w+\([^)]*\))`)
	if !re.MatchString(line) {
		return line, "", ""
	}
	indent := leadingSpaces(line)
	changed := re.ReplaceAllString(line, "$1\n"+indent+"  .$2")
	if changed == line {
		return line, "", ""
	}
	return changed, "J", "this chained call should be on a single line"
}

// transformWrongBoolean flips a boolean literal.
func transformWrongBoolean(line string) (string, string, string) {
	if regexp.MustCompile(`\btrue\b`).MatchString(line) && rand.Float64() < 0.5 {
		return regexp.MustCompile(`\btrue\b`).ReplaceAllString(line, "false"),
			"ciw", "this value should be `true`"
	}
	if regexp.MustCompile(`\bfalse\b`).MatchString(line) && rand.Float64() < 0.5 {
		return regexp.MustCompile(`\bfalse\b`).ReplaceAllString(line, "true"),
			"ciw", "this value should be `false`"
	}
	return line, "", ""
}

// ─── Noise Comments ───────────────────────────────────────────────────────────

var noiseComments = []string{
	"// TODO: refactor",
	"// FIXME: this might be wrong",
	"// NOTE: revisit later",
	"// HACK: temporary solution",
	"// WIP",
	"// @deprecated",
	"// eslint-disable-next-line",
	"// prettier-ignore",
	"// not sure about this",
	"// optimise if needed",
	"// temp variable",
	"// magic number alert",
	"// refactor later",
	"// TODO: cleanup dead code",
	"// FIXME: confusing naming",
}

func pickNoiseComment() string {
	return noiseComments[rand.Intn(len(noiseComments))]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func leadingSpaces(line string) string {
	for i, ch := range line {
		if ch != ' ' && ch != '\t' {
			return line[:i]
		}
	}
	return ""
}