package main

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"
)

type Hub struct {
	mu sync.Mutex

	clients     map[*Client]struct{}
	clientsByID map[string]*Client
	matches     map[string]*Match
	waitingQ    []*Client

	register   chan *Client
	unregister chan *Client
	incoming   chan InboundMessage
}

func NewHub() *Hub {
	return &Hub{
		clients:     make(map[*Client]struct{}),
		clientsByID: make(map[string]*Client),
		matches:     make(map[string]*Match),
		waitingQ:    make([]*Client, 0),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		incoming:    make(chan InboundMessage, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.handleRegister(client)
		case client := <-h.unregister:
			h.handleUnregister(client)
		case inbound := <-h.incoming:
			h.handleIncoming(inbound)
		}
	}
}

func (h *Hub) handleRegister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[client] = struct{}{}
}

func (h *Hub) handleUnregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; !ok {
		return
	}

	delete(h.clients, client)
	h.removeFromQueueLocked(client)

	if client.ID != "" {
		if current, ok := h.clientsByID[client.ID]; ok && current == client {
			delete(h.clientsByID, client.ID)
		}
	}

	if client.MatchID != "" {
		match, ok := h.matches[client.MatchID]
		if ok {
			opponent := match.opponentOf(client)
			now := time.Now().UTC()
			match.Status = MatchFinished
			match.FinishedAt = &now
			if opponent != nil {
				match.WinnerID = opponent.ID
				gameOver := GameOverPayload{
					MatchID:    match.ID,
					WinnerID:   opponent.ID,
					LoserID:    client.ID,
					Reason:     "opponent_disconnected",
					FinishedAt: now.Unix(),
				}
				h.sendLocked(opponent, MsgGameOver, match.ID, opponent.ID, 0, gameOver)
				opponent.MatchID = ""
			}
			delete(h.matches, match.ID)
		}
	}

	close(client.send)
}

func (h *Hub) AttachIdentity(client *Client, playerID string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if existing, exists := h.clientsByID[playerID]; exists && existing != client {
		return fmt.Errorf("player_id_already_connected")
	}

	client.ID = playerID
	h.clientsByID[playerID] = client
	return nil
}

func (h *Hub) EnqueueIncoming(inbound InboundMessage) {
	h.incoming <- inbound
}

func (h *Hub) handleIncoming(inbound InboundMessage) {
	switch inbound.Message.Type {
	case MsgQueueJoin:
		h.enqueueForMatch(inbound.Client)
	case MsgBufferUpdate:
		h.relayBufferUpdate(inbound.Client, inbound.Message)
	case MsgPlayerFinished:
		h.finishMatch(inbound.Client)
	default:
		h.sendError(inbound.Client, "unsupported_message", "unsupported message type")
	}
}

func (h *Hub) enqueueForMatch(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client.ID == "" {
		h.sendErrorLocked(client, "unauthenticated", "send HELLO before queueing")
		return
	}

	if client.MatchID != "" {
		h.sendErrorLocked(client, "already_in_match", "player already in an active match")
		return
	}

	for _, queued := range h.waitingQ {
		if queued == client {
			return
		}
	}

	h.waitingQ = append(h.waitingQ, client)

	for len(h.waitingQ) >= 2 {
		pA := h.waitingQ[0]
		pB := h.waitingQ[1]
		h.waitingQ = h.waitingQ[2:]

		if pA == pB || pA.ID == "" || pB.ID == "" {
			continue
		}

		matchID := newMatchID()
		now := time.Now().UTC()
		targetCode := pickTargetCode()
		pollutedCode := polluteCode(targetCode)
		match := &Match{
			ID:           matchID,
			PlayerA:      pA,
			PlayerB:      pB,
			Status:       MatchPlaying,
			TargetCode:   targetCode,
			PollutedCode: pollutedCode,
			StartedAt:    now,
			LastSeqByID: map[string]int64{
				pA.ID: 0,
				pB.ID: 0,
			},
		}
		h.matches[matchID] = match
		pA.MatchID = matchID
		pB.MatchID = matchID

		startA := GameStartPayload{
			MatchID:      matchID,
			OpponentID:   pB.ID,
			Role:         "A",
			StartedAt:    now.Unix(),
			TargetCode:   targetCode,
			PollutedCode: pollutedCode,
		}
		startB := GameStartPayload{
			MatchID:      matchID,
			OpponentID:   pA.ID,
			Role:         "B",
			StartedAt:    now.Unix(),
			TargetCode:   targetCode,
			PollutedCode: pollutedCode,
		}
		h.sendLocked(pA, MsgGameStart, matchID, pA.ID, 0, startA)
		h.sendLocked(pB, MsgGameStart, matchID, pB.ID, 0, startB)
	}
}

func (h *Hub) relayBufferUpdate(sender *Client, message Envelope) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if sender.MatchID == "" || message.MatchID == "" || sender.MatchID != message.MatchID {
		h.sendErrorLocked(sender, "invalid_match", "buffer update does not belong to active match")
		return
	}

	match, ok := h.matches[sender.MatchID]
	if !ok || match.Status != MatchPlaying {
		h.sendErrorLocked(sender, "match_not_active", "match is not active")
		return
	}

	lastSeq := match.LastSeqByID[sender.ID]
	if message.Seq <= lastSeq {
		return
	}
	match.LastSeqByID[sender.ID] = message.Seq

	opponent := match.opponentOf(sender)
	if opponent == nil {
		h.sendErrorLocked(sender, "opponent_missing", "opponent is unavailable")
		return
	}

	message.PlayerID = sender.ID
	message.Timestamp = time.Now().UTC().Unix()
	h.sendEnvelopeLocked(opponent, message)
}

func (h *Hub) finishMatch(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if client.MatchID == "" {
		h.sendErrorLocked(client, "invalid_match", "no active match to finish")
		return
	}

	match, ok := h.matches[client.MatchID]
	if !ok || match.Status != MatchPlaying {
		h.sendErrorLocked(client, "match_not_active", "match is not active")
		return
	}

	opponent := match.opponentOf(client)
	now := time.Now().UTC()
	match.Status = MatchFinished
	match.FinishedAt = &now
	match.WinnerID = client.ID

	loserID := ""
	if opponent != nil {
		loserID = opponent.ID
	}

	result := GameOverPayload{
		MatchID:    match.ID,
		WinnerID:   client.ID,
		LoserID:    loserID,
		Reason:     "player_finished",
		FinishedAt: now.Unix(),
	}

	h.sendLocked(client, MsgGameOver, match.ID, client.ID, 0, result)
	if opponent != nil {
		h.sendLocked(opponent, MsgGameOver, match.ID, opponent.ID, 0, result)
		opponent.MatchID = ""
	}

	client.MatchID = ""
	delete(h.matches, match.ID)
}

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
		Seq:       seq,
		Timestamp: time.Now().UTC().Unix(),
		Payload:   raw,
	}
	h.sendEnvelopeLocked(client, envelope)
}

func (h *Hub) sendEnvelopeLocked(client *Client, envelope Envelope) {
	select {
	case client.send <- mustMarshalEnvelope(envelope):
	default:
		// Slow connection, close it to protect the hub.
		go client.close()
	}
}

func (h *Hub) removeFromQueueLocked(target *Client) {
	if len(h.waitingQ) == 0 {
		return
	}
	next := h.waitingQ[:0]
	for _, c := range h.waitingQ {
		if c != target {
			next = append(next, c)
		}
	}
	h.waitingQ = next
}

func (m *Match) opponentOf(client *Client) *Client {
	if m.PlayerA == client {
		return m.PlayerB
	}
	if m.PlayerB == client {
		return m.PlayerA
	}
	return nil
}
