package services

import "errors"

var errMatchNotLive = errors.New("match_not_live")

func (h *Hub) GetLiveMatchForPlayer(playerID string) (string, string, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()

	client, ok := h.clientsByID[playerID]
	if !ok || client == nil || client.MatchID == "" {
		return "", "", false
	}

	match, ok := h.matches[client.MatchID]
	if !ok || match == nil || match.Status != MatchPlaying || match.BotID != "" {
		return "", "", false
	}

	return match.ID, "multiplayer", true
}

func (h *Hub) GetLiveMatchesForPlayers(playerIDs []string) map[string]SpectatorStatusPayload {
	h.mu.Lock()
	defer h.mu.Unlock()

	result := make(map[string]SpectatorStatusPayload, len(playerIDs))
	for _, playerID := range playerIDs {
		result[playerID] = SpectatorStatusPayload{State: "offline"}

		client, ok := h.clientsByID[playerID]
		if !ok || client == nil || client.MatchID == "" {
			continue
		}

		match, ok := h.matches[client.MatchID]
		if !ok || match == nil || match.Status != MatchPlaying || match.BotID != "" {
			continue
		}

		result[playerID] = SpectatorStatusPayload{
			State:   "playing",
			MatchID: match.ID,
		}
	}

	return result
}

func (h *Hub) SubscribeSpectator(matchID string) (SpectatorSnapshotPayload, int, <-chan SpectatorEvent, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	match, ok := h.matches[matchID]
	if !ok || match == nil || match.Status != MatchPlaying || match.BotID != "" {
		return SpectatorSnapshotPayload{}, 0, nil, errMatchNotLive
	}

	if match.spectators == nil {
		match.spectators = make(map[int]chan SpectatorEvent)
	}

	spectatorID := match.nextSpectator
	match.nextSpectator++

	ch := make(chan SpectatorEvent, 128)
	match.spectators[spectatorID] = ch
	h.notifySpectatorCountLocked(match)

	snapshot := h.spectatorSnapshotLocked(match)
	return snapshot, spectatorID, ch, nil
}

func (h *Hub) UnsubscribeSpectator(matchID string, spectatorID int) {
	h.mu.Lock()
	defer h.mu.Unlock()

	match, ok := h.matches[matchID]
	if !ok || match == nil || match.spectators == nil {
		return
	}

	ch, ok := match.spectators[spectatorID]
	if !ok {
		return
	}

	delete(match.spectators, spectatorID)
	close(ch)
	h.notifySpectatorCountLocked(match)
}

func (h *Hub) spectatorSnapshotLocked(match *Match) SpectatorSnapshotPayload {
	playerA := SpectatorPlayerSnapshot{}
	playerB := SpectatorPlayerSnapshot{}

	if match.PlayerA != nil {
		playerA = SpectatorPlayerSnapshot{
			PlayerID:    match.PlayerA.ID,
			DisplayName: match.PlayerA.DisplayName,
			AvatarURL:   match.PlayerA.AvatarURL,
		}
	}
	if match.PlayerB != nil {
		playerB = SpectatorPlayerSnapshot{
			PlayerID:    match.PlayerB.ID,
			DisplayName: match.PlayerB.DisplayName,
			AvatarURL:   match.PlayerB.AvatarURL,
		}
	}

	return SpectatorSnapshotPayload{
		MatchID:       match.ID,
		StartedAt:     match.StartedAt.Unix(),
		TargetCode:    match.TargetCode,
		PollutedCode:  match.PollutedCode,
		PlayerA:       playerA,
		PlayerB:       playerB,
		PlayerABuffer: match.PlayerABuffer,
		PlayerBBuffer: match.PlayerBBuffer,
	}
}

func (h *Hub) broadcastSpectatorEventLocked(match *Match, name string, data any) {
	if match == nil || len(match.spectators) == 0 {
		return
	}

	event := SpectatorEvent{Name: name, Data: data}
	for spectatorID, ch := range match.spectators {
		select {
		case ch <- event:
		default:
			close(ch)
			delete(match.spectators, spectatorID)
		}
	}
}

func (h *Hub) closeSpectatorsLocked(match *Match, reason string) {
	if match == nil {
		return
	}

	if len(match.spectators) > 0 {
		h.broadcastSpectatorEventLocked(match, "status", SpectatorStatusPayload{
			State:   "finished",
			Reason:  reason,
			MatchID: match.ID,
		})
	}

	for spectatorID, ch := range match.spectators {
		delete(match.spectators, spectatorID)
		close(ch)
	}
}

func (h *Hub) notifySpectatorCountLocked(match *Match) {
	if match == nil || match.Status != MatchPlaying || match.BotID != "" {
		return
	}

	payload := SpectatorCountPayload{Count: len(match.spectators)}
	if match.PlayerA != nil && match.PlayerA.MatchID == match.ID {
		h.sendLocked(match.PlayerA, MsgSpectatorCount, match.ID, match.PlayerA.ID, 0, payload)
	}
	if match.PlayerB != nil && match.PlayerB.MatchID == match.ID {
		h.sendLocked(match.PlayerB, MsgSpectatorCount, match.ID, match.PlayerB.ID, 0, payload)
	}
}
