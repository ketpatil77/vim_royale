package services

import (
	"encoding/json"
	"log"
	"time"
)

func (h *Hub) sendError(client *Client, code, message string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sendErrorLocked(client, code, message)
}

func (h *Hub) sendErrorLocked(client *Client, code, message string) {
	payload := ErrorPayload{Code: code, Message: message}
	h.sendLocked(client, MsgError, client.MatchID, client.ID, 0, payload)
}

func (h *Hub) sendLocked(client *Client, msgType MessageType, matchID, playerID string, seq int64, payload any) {
	raw, err := json.Marshal(payload)
	if err != nil {
		log.Printf("marshal payload error: %v", err)
		return
	}
	envelope := Envelope{
		Type:      msgType,
		MatchID:   matchID,
		PlayerID:  playerID,
		Seq:      seq,
		Timestamp: time.Now().UTC().Unix(),
		Payload:  raw,
	}
	h.sendEnvelopeLocked(client, envelope)
}

func (h *Hub) sendEnvelopeLocked(client *Client, envelope Envelope) {
	select {
	case client.send <- mustMarshalEnvelope(envelope):
	default:
		go client.close()
	}
}