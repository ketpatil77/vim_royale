package models

import "testing"

func TestParseVimKeybindingSource(t *testing.T) {
	source := `
" comment
nnoremap Y y$
inoremap jj <Esc>
set number
unmap Q
`

	mappings, warnings := ParseVimKeybindingSource(source)
	if len(mappings) != 3 {
		t.Fatalf("expected 3 mappings, got %d", len(mappings))
	}
	if len(warnings) != 1 {
		t.Fatalf("expected 1 warning, got %d", len(warnings))
	}

	if mappings[0].Mode != VimModeNormal || !mappings[0].Noremap || mappings[0].LHS != "Y" || mappings[0].RHS != "y$" {
		t.Fatalf("unexpected first mapping: %+v", mappings[0])
	}

	if mappings[1].Mode != VimModeInsert || !mappings[1].Noremap || mappings[1].LHS != "jj" || mappings[1].RHS != "<Esc>" {
		t.Fatalf("unexpected second mapping: %+v", mappings[1])
	}

	if !mappings[2].Unmap || mappings[2].Mode != VimModeAll || mappings[2].LHS != "Q" {
		t.Fatalf("unexpected unmap mapping: %+v", mappings[2])
	}
}

func TestParseVimKeybindingSourceSupportsWhitespaceAndModeSpecificUnmaps(t *testing.T) {
	source := "   \n\t:nunmap   Q  \n\n"
	mappings, warnings := ParseVimKeybindingSource(source)
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %d", len(warnings))
	}
	if len(mappings) != 1 {
		t.Fatalf("expected one mapping, got %d", len(mappings))
	}
	if !mappings[0].Unmap || mappings[0].Mode != VimModeNormal || mappings[0].LHS != "Q" {
		t.Fatalf("unexpected mapping: %+v", mappings[0])
	}
}

func TestNormalizeVimKeybindingMappings(t *testing.T) {
	input := []VimKeybindingMapping{
		{Mode: "", LHS: "jj", RHS: "<Esc>"},
		{Mode: "bad-mode", LHS: "a", RHS: "b"},
		{Mode: VimModeInsert, LHS: "", RHS: "<Esc>"},
		{Mode: VimModeVisual, LHS: "x", Unmap: true},
	}

	normalized, warnings := NormalizeVimKeybindingMappings(input)
	if len(normalized) != 2 {
		t.Fatalf("expected 2 normalized mappings, got %d", len(normalized))
	}
	if len(warnings) != 2 {
		t.Fatalf("expected 2 warnings, got %d", len(warnings))
	}

	if normalized[0].Mode != VimModeAll || normalized[0].LHS != "jj" || normalized[0].RHS != "<Esc>" {
		t.Fatalf("unexpected normalized mapping: %+v", normalized[0])
	}
	if !normalized[1].Unmap || normalized[1].Mode != VimModeVisual || normalized[1].RHS != "" {
		t.Fatalf("unexpected normalized unmap: %+v", normalized[1])
	}
}

func TestParseVimKeybindingSourceSupportsMapArgumentsAndVariants(t *testing.T) {
	source := `
noremap <silent> <expr> H ^
map! <C-H> <Left>
cnoremap <silent> <C-A> <Home>
unmap! <buffer> <C-H>
`

	mappings, warnings := ParseVimKeybindingSource(source)
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %d", len(warnings))
	}
	if len(mappings) != 4 {
		t.Fatalf("expected 4 mappings, got %d", len(mappings))
	}

	if mappings[0].Mode != VimModeAll || mappings[0].LHS != "H" || mappings[0].RHS != "^" || !mappings[0].Noremap {
		t.Fatalf("unexpected first mapping: %+v", mappings[0])
	}
	if mappings[1].Mode != VimModeInsertCommand || mappings[1].LHS != "<C-H>" || mappings[1].RHS != "<Left>" || mappings[1].Noremap {
		t.Fatalf("unexpected second mapping: %+v", mappings[1])
	}
	if mappings[2].Mode != VimModeInsertCommand || mappings[2].LHS != "<C-A>" || mappings[2].RHS != "<Home>" || !mappings[2].Noremap {
		t.Fatalf("unexpected third mapping: %+v", mappings[2])
	}
	if mappings[3].Mode != VimModeInsertCommand || mappings[3].LHS != "<C-H>" || !mappings[3].Unmap {
		t.Fatalf("unexpected fourth mapping: %+v", mappings[3])
	}
}

func TestParseVimKeybindingSourcePreservesRHSWhitespace(t *testing.T) {
	source := "inoremap <F5>   foo   bar"
	mappings, warnings := ParseVimKeybindingSource(source)
	if len(warnings) != 0 {
		t.Fatalf("expected no warnings, got %d", len(warnings))
	}
	if len(mappings) != 1 {
		t.Fatalf("expected one mapping, got %d", len(mappings))
	}
	if mappings[0].RHS != "foo   bar" {
		t.Fatalf("unexpected rhs %q", mappings[0].RHS)
	}
}
