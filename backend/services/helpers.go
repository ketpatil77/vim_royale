package services

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
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