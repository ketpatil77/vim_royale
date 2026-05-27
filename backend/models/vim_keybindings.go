package models

import (
	"encoding/json"
	"fmt"
	"strings"
)

const VimKeybindingsVersion = 1

type VimMappingMode string

const (
	VimModeAll             VimMappingMode = "all"
	VimModeNormal          VimMappingMode = "normal"
	VimModeInsert          VimMappingMode = "insert"
	VimModeInsertCommand   VimMappingMode = "insertCommand"
	VimModeVisual          VimMappingMode = "visual"
	VimModeOperatorPending VimMappingMode = "operatorPending"
)

type VimKeybindingMapping struct {
	Mode    VimMappingMode `json:"mode"`
	LHS     string         `json:"lhs"`
	RHS     string         `json:"rhs,omitempty"`
	Noremap bool           `json:"noremap,omitempty"`
	Unmap   bool           `json:"unmap,omitempty"`
}

type VimKeybindingWarning struct {
	Line    int    `json:"line"`
	Content string `json:"content"`
	Message string `json:"message"`
}

type VimKeybindingsResponse struct {
	Mappings []VimKeybindingMapping `json:"mappings"`
	Warnings []VimKeybindingWarning `json:"warnings"`
	Version  int                    `json:"version"`
}

type UpdateVimKeybindingsRequest struct {
	Source   *string                `json:"source,omitempty"`
	Mappings []VimKeybindingMapping `json:"mappings,omitempty"`
}

func ParseVimKeybindingSource(source string) ([]VimKeybindingMapping, []VimKeybindingWarning) {
	lines := strings.Split(source, "\n")
	mappings := make([]VimKeybindingMapping, 0)
	warnings := make([]VimKeybindingWarning, 0)

	for idx, raw := range lines {
		lineNumber := idx + 1
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "\"") {
			continue
		}
		if strings.HasPrefix(line, ":") {
			line = strings.TrimSpace(strings.TrimPrefix(line, ":"))
		}

		commandToken, rest, ok := consumeToken(line)
		if !ok {
			continue
		}

		command := strings.ToLower(commandToken)
		mode, noremap, unmap, ok := commandToMappingSpec(command)
		if !ok {
			warnings = append(warnings, VimKeybindingWarning{
				Line:    lineNumber,
				Content: raw,
				Message: fmt.Sprintf("unsupported command %q", commandToken),
			})
			continue
		}

		token, remaining, ok := consumeToken(rest)
		for ok && isMapArgumentToken(token) {
			token, remaining, ok = consumeToken(remaining)
		}
		if !ok {
			warnings = append(warnings, VimKeybindingWarning{
				Line:    lineNumber,
				Content: raw,
				Message: "missing left-hand key sequence",
			})
			continue
		}

		lhs := strings.TrimSpace(token)
		if lhs == "" {
			warnings = append(warnings, VimKeybindingWarning{
				Line:    lineNumber,
				Content: raw,
				Message: "left-hand key sequence cannot be empty",
			})
			continue
		}

		if unmap {
			mappings = append(mappings, VimKeybindingMapping{
				Mode:  mode,
				LHS:   lhs,
				Unmap: true,
			})
			continue
		}

		rhs := trimLeadingHorizontalWhitespace(remaining)
		if strings.TrimSpace(rhs) == "" {
			warnings = append(warnings, VimKeybindingWarning{
				Line:    lineNumber,
				Content: raw,
				Message: "missing right-hand key sequence",
			})
			continue
		}

		mappings = append(mappings, VimKeybindingMapping{
			Mode:    mode,
			LHS:     lhs,
			RHS:     rhs,
			Noremap: noremap,
		})
	}

	return mappings, warnings
}

func NormalizeVimKeybindingMappings(mappings []VimKeybindingMapping) ([]VimKeybindingMapping, []VimKeybindingWarning) {
	normalized := make([]VimKeybindingMapping, 0, len(mappings))
	warnings := make([]VimKeybindingWarning, 0)

	for idx, input := range mappings {
		lineNumber := idx + 1

		mode := input.Mode
		if mode == "" {
			mode = VimModeAll
		}
		if !isSupportedMode(mode) {
			warnings = append(warnings, VimKeybindingWarning{
				Line:    lineNumber,
				Message: fmt.Sprintf("unsupported mode %q", input.Mode),
			})
			continue
		}

		lhs := strings.TrimSpace(input.LHS)
		if lhs == "" {
			warnings = append(warnings, VimKeybindingWarning{
				Line:    lineNumber,
				Message: "left-hand key sequence cannot be empty",
			})
			continue
		}

		mapping := VimKeybindingMapping{
			Mode:    mode,
			LHS:     lhs,
			Noremap: input.Noremap,
			Unmap:   input.Unmap,
		}

		if mapping.Unmap {
			mapping.RHS = ""
		} else {
			rhs := input.RHS
			if strings.TrimSpace(rhs) == "" {
				warnings = append(warnings, VimKeybindingWarning{
					Line:    lineNumber,
					Message: "right-hand key sequence cannot be empty",
				})
				continue
			}
			mapping.RHS = rhs
		}

		normalized = append(normalized, mapping)
	}

	return normalized, warnings
}

func EncodeVimKeybindings(mappings []VimKeybindingMapping) (string, error) {
	normalized, warnings := NormalizeVimKeybindingMappings(mappings)
	if len(warnings) > 0 {
		return "", fmt.Errorf("cannot encode invalid keybindings")
	}

	payload, err := json.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func DecodeVimKeybindings(raw string) []VimKeybindingMapping {
	if strings.TrimSpace(raw) == "" {
		return []VimKeybindingMapping{}
	}

	var parsed []VimKeybindingMapping
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return []VimKeybindingMapping{}
	}

	normalized, _ := NormalizeVimKeybindingMappings(parsed)
	return normalized
}

func commandToMappingSpec(command string) (VimMappingMode, bool, bool, bool) {
	switch command {
	case "map":
		return VimModeAll, false, false, true
	case "nmap":
		return VimModeNormal, false, false, true
	case "imap":
		return VimModeInsert, false, false, true
	case "vmap":
		return VimModeVisual, false, false, true
	case "xmap", "smap":
		return VimModeVisual, false, false, true
	case "omap":
		return VimModeOperatorPending, false, false, true
	case "lmap", "cmap", "tmap", "map!":
		return VimModeInsertCommand, false, false, true
	case "noremap":
		return VimModeAll, true, false, true
	case "nnoremap":
		return VimModeNormal, true, false, true
	case "inoremap":
		return VimModeInsert, true, false, true
	case "vnoremap":
		return VimModeVisual, true, false, true
	case "xnoremap", "snoremap":
		return VimModeVisual, true, false, true
	case "onoremap":
		return VimModeOperatorPending, true, false, true
	case "lnoremap", "cnoremap", "tnoremap", "noremap!":
		return VimModeInsertCommand, true, false, true
	case "unmap":
		return VimModeAll, false, true, true
	case "nunmap":
		return VimModeNormal, false, true, true
	case "iunmap":
		return VimModeInsert, false, true, true
	case "vunmap":
		return VimModeVisual, false, true, true
	case "xunmap", "sunmap":
		return VimModeVisual, false, true, true
	case "ounmap":
		return VimModeOperatorPending, false, true, true
	case "lunmap", "cunmap", "tunmap", "unmap!":
		return VimModeInsertCommand, false, true, true
	default:
		return "", false, false, false
	}
}

func isSupportedMode(mode VimMappingMode) bool {
	switch mode {
	case VimModeAll, VimModeNormal, VimModeInsert, VimModeInsertCommand, VimModeVisual, VimModeOperatorPending:
		return true
	default:
		return false
	}
}

func isMapArgumentToken(token string) bool {
	switch strings.ToLower(strings.TrimSpace(token)) {
	case "<buffer>", "<nowait>", "<silent>", "<special>", "<script>", "<expr>", "<unique>":
		return true
	default:
		return false
	}
}

func trimLeadingHorizontalWhitespace(value string) string {
	return strings.TrimLeft(value, " \t")
}

func consumeToken(value string) (string, string, bool) {
	trimmed := trimLeadingHorizontalWhitespace(value)
	if trimmed == "" {
		return "", "", false
	}

	index := strings.IndexAny(trimmed, " \t")
	if index == -1 {
		return trimmed, "", true
	}

	return trimmed[:index], trimmed[index:], true
}
