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
	mu sync.Mutex

	clients        map[*Client]struct{}
	clientsByID    map[string]*Client
	matches        map[string]*Match
	waitingBuckets [numBuckets]*ratingBucket

	Register   chan *Client
	Unregister chan *Client
	incoming   chan InboundMessage
}

func NewHub() *Hub {
	h := &Hub{
		clients:        make(map[*Client]struct{}),
		clientsByID:    make(map[string]*Client),
		matches:        make(map[string]*Match),
		waitingBuckets: [numBuckets]*ratingBucket{},
		Register:       make(chan *Client),
		Unregister:     make(chan *Client),
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
				var winnerDelta, loserDelta, winnerNewRating, loserNewRating float64
				var winnerName, winnerAvatar, loserName, loserAvatar string

				winnerName = opponent.DisplayName
				winnerAvatar = opponent.AvatarURL
				loserName = client.DisplayName
				loserAvatar = client.AvatarURL

				dbConn, err := database.GetPostgresConnection()
				if err == nil {
					wd, ld, wnr, lnr, mErr := database.CreateMatchAndSendRatingDelta(dbConn, opponent.ID, client.ID)
					if mErr == nil {
						winnerDelta = wd
						loserDelta = ld
						winnerNewRating = wnr
						loserNewRating = lnr
					}
				}

				gameOver := GameOverPayload{
					MatchID:         match.ID,
					WinnerID:         opponent.ID,
					LoserID:          client.ID,
					WinnerName:      winnerName,
					WinnerAvatar:    winnerAvatar,
					WinnerNewRating: winnerNewRating,
					WinnerDelta:     winnerDelta,
					LoserName:       loserName,
					LoserAvatar:     loserAvatar,
					LoserNewRating:  loserNewRating,
					LoserDelta:      loserDelta,
					Reason:          "opponent_disconnected",
					FinishedAt:      now.Unix(),
				}

				h.sendLocked(opponent, MsgGameOver, match.ID, opponent.ID, 0, gameOver)
				opponent.MatchID = ""
			}
			delete(h.matches, match.ID)
		}
	}

	close(client.send)
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
