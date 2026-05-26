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

	var payload BufferUpdatePayload
	if err := json.Unmarshal(message.Payload, &payload); err == nil {
		if payload.Delta != nil {
			if sender == match.PlayerA {
				match.PlayerABuffer = applyBufferDelta(match.PlayerABuffer, payload.Delta)
			} else if sender == match.PlayerB {
				match.PlayerBBuffer = applyBufferDelta(match.PlayerBBuffer, payload.Delta)
			}
		} else if payload.Content != nil {
			if sender == match.PlayerA {
				match.PlayerABuffer = *payload.Content
			} else if sender == match.PlayerB {
				match.PlayerBBuffer = *payload.Content
			}
		}
	}

	timestamp := time.Now().UTC().Unix()
	message.PlayerID = sender.ID
	message.Timestamp = timestamp
	h.broadcastSpectatorEventLocked(match, "delta", SpectatorDeltaPayload{
		PlayerID:  sender.ID,
		Seq:       message.Seq,
		Timestamp: timestamp,
		Delta:     payload.Delta,
		Content:   payload.Content,
	})

	if match.BotID != "" {
		// Bot games don't relay player deltas to another websocket peer.
		return
	}

	opponent := match.opponentOf(sender)
	if opponent == nil {
		h.sendErrorLocked(sender, "opponent_missing", "opponent is unavailable")
		return
	}

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

	if match.BotID != "" {
		h.finishBotMatch(match, client)
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
		if match.TournamentID != nil {
			if loserID != "" {
				if err := database.ReportTournamentLiveMatchResult(dbConn, *match.TournamentID, match.ID, client.ID, loserID); err != nil {
					log.Printf("failed to report tournament match result: %v", err)
				} else {
					PublishTournamentEvent(*match.TournamentID, "match_completed")
				}
			}
			winnerNewRating = float64(client.Rating)
			if opponent != nil {
				loserNewRating = float64(opponent.Rating)
			}
		} else {
			persistedMatchID, wd, ld, wnr, lnr, mErr := database.CreateMatchAndSendRatingDelta(
				dbConn,
				client.ID,
				loserID,
				match.TargetCode,
				match.PollutedCode,
			)
			if mErr != nil {
				log.Printf("failed to create match: %v", mErr)
			} else {
				winnerDelta = wd
				loserDelta = ld
				winnerNewRating = wnr
				loserNewRating = lnr
				if keystrokesData != nil && len(keystrokesData.PlayerA) > 0 {
					playerAData, _ := json.Marshal(keystrokesData.PlayerA)
					playerBData, _ := json.Marshal(keystrokesData.PlayerB)
					if err := database.SaveMatchKeystrokes(dbConn, persistedMatchID, client.ID, playerAData, playerBData); err != nil {
						log.Printf("failed to save match keystrokes: %v", err)
					}
				}
			}
		}
	}

	result := GameOverPayload{
		MatchID:         match.ID,
		WinnerID:        client.ID,
		LoserID:         loserID,
		WinnerName:      winnerName,
		WinnerAvatar:    winnerAvatar,
		WinnerNewRating: winnerNewRating,
		WinnerDelta:     winnerDelta,
		LoserName:       loserName,
		LoserAvatar:     loserAvatar,
		LoserNewRating:  loserNewRating,
		LoserDelta:      loserDelta,
		ResultType:      "decisive",
		Reason:          "player_finished",
		FinishedAt:      now.Unix(),
	}

	h.sendLocked(client, MsgGameOver, match.ID, client.ID, 0, result)
	if opponent != nil {
		h.sendLocked(opponent, MsgGameOver, match.ID, opponent.ID, 0, result)
		opponent.MatchID = ""
	}

	client.MatchID = ""
	h.closeSpectatorsLocked(match, "player_finished")
	delete(h.matches, match.ID)
}

func (h *Hub) finishBotMatch(match *Match, client *Client) {
	now := time.Now().UTC()
	match.Status = MatchFinished
	match.FinishedAt = &now

	botMatch := match.BotMatch
	if botMatch != nil {
		botMatch.PlayerFinished = true
	}

	botID := match.BotID
	botName := "Bot"
	botAvatar := ""
	botRating := 0
	if match.Bot != nil {
		botName = match.Bot.Name
		botAvatar = match.Bot.Avatar
		botRating = match.Bot.Rating
	}

	playerWon := botMatch == nil || !botMatch.BotFinished
	winnerID := client.ID
	loserID := "bot_" + botID
	winnerName := client.DisplayName
	winnerAvatar := client.AvatarURL
	loserName := botName
	loserAvatar := botAvatar
	winnerNewRating := float64(client.Rating)
	loserNewRating := float64(botRating)

	if !playerWon {
		winnerID = loserID
		loserID = client.ID
		winnerName = botName
		winnerAvatar = botAvatar
		loserName = client.DisplayName
		loserAvatar = client.AvatarURL
		winnerNewRating = float64(botRating)
		loserNewRating = float64(client.Rating)
	}

	match.WinnerID = winnerID

	result := GameOverPayload{
		MatchID:         match.ID,
		WinnerID:        winnerID,
		LoserID:         loserID,
		WinnerName:      winnerName,
		WinnerAvatar:    winnerAvatar,
		WinnerNewRating: winnerNewRating,
		WinnerDelta:     0,
		LoserName:       loserName,
		LoserAvatar:     loserAvatar,
		LoserNewRating:  loserNewRating,
		LoserDelta:      0,
		ResultType:      "decisive",
		Reason:          "player_finished",
		FinishedAt:      now.Unix(),
	}

	h.sendLocked(client, MsgGameOver, match.ID, client.ID, 0, result)
	client.MatchID = ""
	h.closeSpectatorsLocked(match, "player_finished")
	delete(h.matches, match.ID)
}

func (h *Hub) finishMatchAsDraw(matchID, reason string) {
	h.mu.Lock()
	match, ok := h.matches[matchID]
	if !ok || match.Status != MatchPlaying || match.BotID != "" {
		h.mu.Unlock()
		return
	}

	playerA := match.PlayerA
	playerB := match.PlayerB
	now := time.Now().UTC()
	match.Status = MatchFinished
	match.FinishedAt = &now
	match.WinnerID = ""

	if playerA != nil {
		playerA.MatchID = ""
	}
	if playerB != nil {
		playerB.MatchID = ""
	}
	h.closeSpectatorsLocked(match, reason)
	delete(h.matches, match.ID)
	h.mu.Unlock()

	if playerA != nil && playerB != nil {
		dbConn, err := database.GetPostgresConnection()
		if err != nil {
			log.Printf("failed to get postgres connection: %v", err)
		} else if match.TournamentID != nil {
			if err := database.RequeueTournamentLiveMatch(dbConn, *match.TournamentID, match.ID); err != nil {
				log.Printf("failed to requeue drawn tournament match: %v", err)
			} else {
				PublishTournamentEvent(*match.TournamentID, "match_requeued")
			}
		} else if _, err := database.CreateDrawMatch(dbConn, playerA.ID, playerB.ID, match.TargetCode, match.PollutedCode); err != nil {
			log.Printf("failed to persist drawn match: %v", err)
		}
	}

	aID, aName, aAvatar := "", "Player A", ""
	bID, bName, bAvatar := "", "Player B", ""
	aRating, bRating := 0.0, 0.0

	if playerA != nil {
		aID = playerA.ID
		aName = playerA.DisplayName
		aAvatar = playerA.AvatarURL
		aRating = float64(playerA.Rating)
	}
	if playerB != nil {
		bID = playerB.ID
		bName = playerB.DisplayName
		bAvatar = playerB.AvatarURL
		bRating = float64(playerB.Rating)
	}

	result := GameOverPayload{
		MatchID:         match.ID,
		WinnerID:        aID,
		LoserID:         bID,
		WinnerName:      aName,
		WinnerAvatar:    aAvatar,
		WinnerNewRating: aRating,
		WinnerDelta:     0,
		LoserName:       bName,
		LoserAvatar:     bAvatar,
		LoserNewRating:  bRating,
		LoserDelta:      0,
		ResultType:      "draw",
		Reason:          reason,
		FinishedAt:      now.Unix(),
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	if playerA != nil {
		h.sendLocked(playerA, MsgGameOver, match.ID, playerA.ID, 0, result)
	}
	if playerB != nil {
		h.sendLocked(playerB, MsgGameOver, match.ID, playerB.ID, 0, result)
	}
}
