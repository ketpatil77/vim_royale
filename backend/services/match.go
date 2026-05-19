package services

import (
	"encoding/json"
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

func (h *Hub) finishMatch(client *Client, message Envelope) {
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
	var winnerName, winnerAvatar, loserName, loserAvatar string
	var winnerDelta, loserDelta, winnerNewRating, loserNewRating float64

	if opponent != nil {
		loserID = opponent.ID
		winnerName = client.DisplayName
		winnerAvatar = client.AvatarURL
		loserName = opponent.DisplayName
		loserAvatar = opponent.AvatarURL
	}

	var keystrokesData *KeystrokesData
	if message.Payload != nil {
		var payload PlayerFinishedPayload
		if err := json.Unmarshal(message.Payload, &payload); err == nil {
			keystrokesData = payload.Keystrokes
		}
	}

	dbConn, err := database.GetPostgresConnection()
	if err != nil {
		log.Printf("failed to get postgres connection: %v", err)
	} else {
		wd, ld, wnr, lnr, mErr := database.CreateMatchAndSendRatingDelta(dbConn, client.ID, loserID)
		if mErr != nil {
			log.Printf("failed to create match: %v", mErr)
		} else {
			winnerDelta = wd
			loserDelta = ld
			winnerNewRating = wnr
			loserNewRating = lnr
		}

		if keystrokesData != nil {
			if len(keystrokesData.PlayerA) > 0 {
				playerAData, _ := json.Marshal(keystrokesData.PlayerA)
				playerBData, _ := json.Marshal(keystrokesData.PlayerB)
				database.SaveMatchKeystrokes(dbConn, match.ID, client.ID, playerAData, playerBData)
			}
		}
	}

	result := GameOverPayload{
		MatchID:         match.ID,
		WinnerID:         client.ID,
		LoserID:          loserID,
		WinnerName:       winnerName,
		WinnerAvatar:    winnerAvatar,
		WinnerNewRating: winnerNewRating,
		WinnerDelta:     winnerDelta,
		LoserName:       loserName,
		LoserAvatar:     loserAvatar,
		LoserNewRating:  loserNewRating,
		LoserDelta:      loserDelta,
		Reason:          "player_finished",
		FinishedAt:      now.Unix(),
	}

	h.sendLocked(client, MsgGameOver, match.ID, client.ID, 0, result)
	if opponent != nil {
		h.sendLocked(opponent, MsgGameOver, match.ID, opponent.ID, 0, result)
		opponent.MatchID = ""
	}

	client.MatchID = ""
	delete(h.matches, match.ID)
}