package services

import (
	"log"
	"time"

	database "vim_royale/backend/db"
)

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
		Reason:    "player_finished",
		FinishedAt: now.Unix(),
	}

	dbConn, err := database.GetPostgresConnection()
	if err != nil {
		log.Printf("failed to get postgres connection: %v", err)
	} else {
		if err := database.CreateMatch(dbConn, client.ID, loserID); err != nil {
			log.Printf("failed to create match: %v", err)
		}
	}

	h.sendLocked(client, MsgGameOver, match.ID, client.ID, 0, result)
	if opponent != nil {
		h.sendLocked(opponent, MsgGameOver, match.ID, opponent.ID, 0, result)
		opponent.MatchID = ""
	}

	client.MatchID = ""
	delete(h.matches, match.ID)
}