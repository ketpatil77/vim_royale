package services

import (
	"encoding/json"
	"math/rand"
	"time"

	"vim_royale/backend/utils"
)

func buildFallbackSequence(bot Bot, targetCode string) BotDeltaSequence {
	baseDelay, jitter, typoChance := speedProfile(bot.Difficulty)
	runes := []rune(targetCode)
	deltas := make([]TimedDelta, 0, len(runes)+8)

	elapsed := 0
	pos := 0
	for pos < len(runes) {
		if pos > 2 && rand.Float64() < typoChance {
			wrong := randomWrongRune(runes[pos])
			elapsed += randomDelay(baseDelay, jitter)
			deltas = append(deltas, TimedDelta{AfterMs: elapsed, Ops: marshalOps(insertOp(pos, string(wrong)))})
			pos++

			elapsed += randomDelay(maxInt(45, baseDelay/2), maxInt(20, jitter/2))
			deltas = append(deltas, TimedDelta{AfterMs: elapsed, Ops: marshalOps(deleteOp(pos-1, pos))})
			pos--
		}

		elapsed += randomDelay(baseDelay, jitter)
		deltas = append(deltas, TimedDelta{AfterMs: elapsed, Ops: marshalOps(insertOp(pos, string(runes[pos])))})
		pos++
	}

	return BotDeltaSequence{
		TargetCode:   targetCode,
		FinishedAtMs: elapsed,
		Deltas:       deltas,
	}
}

func speedProfile(difficulty string) (baseDelayMs int, jitterMs int, typoChance float64) {
	switch difficulty {
	case "beginner":
		return 185, 90, 0.12
	case "easy":
		return 150, 70, 0.08
	case "medium":
		return 120, 55, 0.06
	case "hard":
		return 95, 40, 0.04
	case "expert":
		return 78, 28, 0.02
	default:
		return 130, 60, 0.05
	}
}

func randomDelay(base, jitter int) int {
	if jitter <= 0 {
		return base
	}
	return base + rand.Intn(jitter*2+1) - jitter
}

func randomWrongRune(expected rune) rune {
	alphabet := []rune("abcdefghijklmnopqrstuvwxyz")
	for {
		candidate := alphabet[rand.Intn(len(alphabet))]
		if candidate != expected {
			return candidate
		}
	}
}

func insertOp(pos int, text string) map[string]any {
	return map[string]any{
		"type": "insert",
		"pos":  pos,
		"text": text,
	}
}

func deleteOp(from, to int) map[string]any {
	return map[string]any{
		"type": "delete",
		"from": from,
		"to":   to,
	}
}

func marshalOps(ops ...map[string]any) json.RawMessage {
	raw, _ := json.Marshal(ops)
	return raw
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (h *Hub) startBotGame(client *Client, botID string) {
	if botManager == nil {
		h.sendError(client, "bot_unavailable", "bot manager unavailable")
		return
	}

	bot := botManager.GetBot(botID)
	if bot == nil {
		h.sendError(client, "invalid_bot", "bot not found")
		return
	}

	now := time.Now().UTC()
	matchID := newMatchID()
	targetCode := utils.PickTargetCode()
	pollutedCode := utils.PolluteCode(targetCode, bot.Rating)
	sequence := botManager.PickSequence(botID, targetCode)

	botMatch := &BotMatch{
		BotID:     bot.ID,
		BotName:   bot.Name,
		BotAvatar: bot.Avatar,
		BotRating: bot.Rating,
		PlayerID:  client.ID,
		Sequence:  sequence,
	}

	h.mu.Lock()
	if !h.isClientActiveLocked(client) {
		h.mu.Unlock()
		return
	}
	if client.MatchID != "" {
		h.sendErrorLocked(client, "already_in_match", "player already in an active match")
		h.mu.Unlock()
		return
	}

	match := &Match{
		ID:           matchID,
		PlayerA:      client,
		PlayerB:      nil,
		BotID:        bot.ID,
		Bot:          bot,
		Status:       MatchPlaying,
		TargetCode:   targetCode,
		PollutedCode: pollutedCode,
		StartedAt:    now,
		LastSeqByID: map[string]int64{
			client.ID: 0,
		},
		BotMatch: botMatch,
	}
	h.matches[matchID] = match
	client.MatchID = matchID

	startPayload := BotGameStartPayload{
		MatchID:      matchID,
		BotID:        bot.ID,
		BotName:      bot.Name,
		BotAvatar:    bot.Avatar,
		BotRating:    bot.Rating,
		Role:         "A",
		StartedAt:    now.Unix(),
		TargetCode:   targetCode,
		PollutedCode: pollutedCode,
	}
	h.sendLocked(client, MsgBotGameStart, matchID, client.ID, 0, startPayload)
	h.mu.Unlock()

	go h.runBotReplay(matchID)
}

func (h *Hub) runBotReplay(matchID string) {
	h.mu.Lock()
	match, ok := h.matches[matchID]
	if !ok || match.BotMatch == nil || match.Status != MatchPlaying {
		h.mu.Unlock()
		return
	}
	sequence := match.BotMatch.Sequence
	h.mu.Unlock()

	if len(sequence.Deltas) == 0 {
		h.mu.Lock()
		if current, ok := h.matches[matchID]; ok && current.BotMatch != nil {
			current.BotMatch.BotFinished = true
		}
		h.mu.Unlock()
		return
	}

	previousMs := 0
	for _, delta := range sequence.Deltas {
		waitMs := delta.AfterMs - previousMs
		if waitMs > 0 {
			timer := time.NewTimer(time.Duration(waitMs) * time.Millisecond)
			<-timer.C
		}
		previousMs = delta.AfterMs

		h.mu.Lock()
		current, ok := h.matches[matchID]
		if !ok || current.Status != MatchPlaying || current.BotMatch == nil {
			h.mu.Unlock()
			return
		}
		player := current.PlayerA
		if player == nil {
			h.mu.Unlock()
			return
		}

		var ops any
		if err := json.Unmarshal(delta.Ops, &ops); err == nil {
			payload := map[string]any{
				"delta": map[string]any{
					"ops": ops,
				},
			}
			h.sendLocked(player, MsgBufferUpdate, matchID, current.BotMatch.BotID, 0, payload)
		}
		h.mu.Unlock()
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	match, ok = h.matches[matchID]
	if !ok || match.BotMatch == nil {
		return
	}
	match.BotMatch.BotFinished = true
	if match.BotMatch.PlayerFinished {
		return
	}

	player := match.PlayerA
	if player == nil {
		delete(h.matches, match.ID)
		return
	}

	now := time.Now().UTC()
	match.Status = MatchFinished
	match.FinishedAt = &now
	match.WinnerID = "bot_" + match.BotID

	botName := "Bot"
	botAvatar := ""
	botRating := 0
	if match.Bot != nil {
		botName = match.Bot.Name
		botAvatar = match.Bot.Avatar
		botRating = match.Bot.Rating
	}

	result := GameOverPayload{
		MatchID:         match.ID,
		WinnerID:        match.WinnerID,
		LoserID:         player.ID,
		WinnerName:      botName,
		WinnerAvatar:    botAvatar,
		WinnerNewRating: float64(botRating),
		WinnerDelta:     0,
		LoserName:       player.DisplayName,
		LoserAvatar:     player.AvatarURL,
		LoserNewRating:  float64(player.Rating),
		LoserDelta:      0,
		Reason:          "player_finished",
		FinishedAt:      now.Unix(),
	}

	h.sendLocked(player, MsgGameOver, match.ID, player.ID, 0, result)
	player.MatchID = ""
	delete(h.matches, match.ID)
}
