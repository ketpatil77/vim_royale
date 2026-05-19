package services

import (
	"sync"
	"time"

	database "vim_royale/backend/db"
)

type ratingBucket struct {
	mu      sync.Mutex
	players []*Client
}

const numBuckets = 41

type Hub struct {
	mu             sync.Mutex
	clients        map[*Client]struct{}
	clientsByID    map[string]*Client
	matches        map[string]*Match
	waitingBuckets [numBuckets]*ratingBucket
	Register       chan *Client
	Unregister     chan *Client
	incoming       chan InboundMessage
}

func NewHub() *Hub {
	h := &Hub{
		clients:        make(map[*Client]struct{}),
		clientsByID:    make(map[string]*Client),
		matches:        make(map[string]*Match),
		waitingBuckets: [numBuckets]*ratingBucket{},
		Register:       make(chan *Client, 256),
		Unregister:     make(chan *Client, 256),
		incoming:       make(chan InboundMessage, 256),
	}
	for i := range h.waitingBuckets {
		h.waitingBuckets[i] = &ratingBucket{}
	}
	return h
}

func (h *Hub) Run() {
	go h.runMatchExpansion()
	for {
		select {
		case client := <-h.Register:
			h.handleRegister(client)
		case client := <-h.Unregister:
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

	if _, ok := h.clients[client]; !ok {
		h.mu.Unlock()
		return
	}

	delete(h.clients, client)
	h.removeFromQueueLocked(client)

	if client.ID != "" {
		if current, ok := h.clientsByID[client.ID]; ok && current == client {
			delete(h.clientsByID, client.ID)
		}
	}

	// Capture match state before releasing the lock
	var opponent *Client
	var match *Match
	if client.MatchID != "" {
		if m, ok := h.matches[client.MatchID]; ok {
			match = m
			opponent = m.opponentOf(client)
			delete(h.matches, match.ID)
		}
	}

	close(client.send)
	h.mu.Unlock() // Release lock before any slow work

	// Offload DB call and notification to a goroutine
	// so the hub loop is never blocked
	if match != nil && opponent != nil {
		go h.handleDisconnectWin(match, opponent, client)
	}
}

// handleDisconnectWin runs outside the hub loop.
// It writes the match result to the DB and notifies the winning opponent.
func (h *Hub) handleDisconnectWin(match *Match, winner *Client, loser *Client) {
	now := time.Now().UTC()
	match.Status = MatchFinished
	match.FinishedAt = &now
	match.WinnerID = winner.ID

	var winnerDelta, loserDelta, winnerNewRating, loserNewRating float64

	dbConn, err := database.GetPostgresConnection()
	if err == nil {
		_, wd, ld, wnr, lnr, mErr := database.CreateMatchAndSendRatingDelta(
			dbConn, winner.ID, loser.ID, match.TargetCode, match.PollutedCode,
		)
		if mErr == nil {
			winnerDelta = wd
			loserDelta = ld
			winnerNewRating = wnr
			loserNewRating = lnr
		}
	}

	gameOver := GameOverPayload{
		MatchID:         match.ID,
		WinnerID:        winner.ID,
		LoserID:         loser.ID,
		WinnerName:      winner.DisplayName,
		WinnerAvatar:    winner.AvatarURL,
		WinnerNewRating: winnerNewRating,
		WinnerDelta:     winnerDelta,
		LoserName:       loser.DisplayName,
		LoserAvatar:     loser.AvatarURL,
		LoserNewRating:  loserNewRating,
		LoserDelta:      loserDelta,
		Reason:          "opponent_disconnected",
		FinishedAt:      now.Unix(),
	}

	h.sendLocked(winner, MsgGameOver, match.ID, winner.ID, 0, gameOver)
	winner.MatchID = ""
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
		h.finishMatch(inbound.Client, inbound.Message)
	default:
		h.sendError(inbound.Client, "unsupported_message", "unsupported message type")
	}
}
