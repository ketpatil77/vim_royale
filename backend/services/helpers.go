package services

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"unicode"
)

var errProtocol = errors.New("protocol_error")

func newMatchID() string {
	buf := make([]byte, 8)
	_, _ = rand.Read(buf)
	return "match_" + hex.EncodeToString(buf)
}

func mustMarshalEnvelope(envelope Envelope) []byte {
	b, err := json.Marshal(envelope)
	if err != nil {
		return []byte(`{"type":"ERROR","payload":{"code":"marshal_error","message":"failed to encode message"}}`)
	}
	return b
}

func normalizeDisplayName(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "Guest"
	}

	clean := strings.Map(func(r rune) rune {
		switch {
		case unicode.IsLetter(r), unicode.IsDigit(r):
			return r
		case r == ' ', r == '-', r == '_':
			return r
		default:
			return -1
		}
	}, trimmed)

	clean = strings.Join(strings.Fields(clean), " ")
	if clean == "" {
		return "Guest"
	}

	runes := []rune(clean)
	if len(runes) > 48 {
		clean = string(runes[:48])
	}
	return clean
}
