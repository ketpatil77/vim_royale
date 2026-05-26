package services

import (
	"strings"
	"time"

	database "vim_royale/backend/db"
	"vim_royale/backend/utils"
)

const (
	roundDuration          = 3 * time.Minute
	countdownGraceDuration = 3 * time.Second
	roundDurationInSeconds = int(roundDuration / time.Second)
)

func (h *Hub) enqueueForMatch(client *Client, payload QueueJoinPayload) {
	if payload.TournamentID > 0 || strings.EqualFold(payload.QueueType, "tournament") {
		h.enqueueForTournamentMatch(client, payload)
		return
	}
	h.enqueueForRankedMatch(client)
}

func (h *Hub) enqueueForRankedMatch(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if !h.isClientActiveLocked(client) {
		return
	}
	if client.ID == "" {
		h.sendErrorLocked(client, "unauthenticated", "send HELLO before queueing")
		return
	}
	if client.MatchID != "" {
		h.sendErrorLocked(client, "already_in_match", "player already in an active match")
		return
	}

	if client.QueueType == "tournament" && client.TournamentID > 0 {
		h.removeFromQueueLocked(client)
	}

	bucketIdx := client.Rating
	if bucketIdx < 0 || bucketIdx >= numBuckets {
		bucketIdx = 0
	}
	bucket := h.waitingBuckets[bucketIdx]

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	for _, queued := range bucket.players {
		if queued.ID == client.ID {
			h.sendErrorLocked(client, "already_queued", "player already in queue")
			return
		}
	}

	bucket.players = append(bucket.players, client)
	client.QueueType = "ranked"
	client.TournamentID = 0
	client.TournamentParticipantID = 0
	client.TournamentExpectedOpponentID = ""
	client.EnqueuedAt = time.Now()

	h.tryMatchBucket(bucket)
}

func (h *Hub) enqueueForTournamentMatch(client *Client, payload QueueJoinPayload) {
	tournamentID := payload.TournamentID
	if tournamentID == 0 {
		h.sendError(client, "invalid_queue", "tournamentId is required for tournament queue")
		return
	}

	eligibility, err := h.lookupTournamentQueueEligibility(client.ID, tournamentID)
	if err != nil {
		h.sendError(client, "tournament_lookup_failed", "unable to validate tournament eligibility")
		return
	}
	if !eligibility.Eligible {
		h.sendError(client, eligibility.ReasonCode, "player is not eligible for tournament matchmaking")
		return
	}
	participant := eligibility.Participant
	if participant == nil {
		h.sendError(client, "tournament_access_denied", "player is not part of this tournament")
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if !h.isClientActiveLocked(client) {
		return
	}
	if client.ID == "" {
		h.sendErrorLocked(client, "unauthenticated", "send HELLO before queueing")
		return
	}
	if client.MatchID != "" {
		h.sendErrorLocked(client, "already_in_match", "player already in an active match")
		return
	}

	if strings.TrimSpace(client.DisplayName) == "" {
		client.DisplayName = normalizeDisplayName(participant.DisplayName)
	}
	if strings.TrimSpace(client.AvatarURL) == "" {
		client.AvatarURL = participant.AvatarURL
	}

	if client.QueueType == "ranked" {
		h.removeFromQueueLocked(client)
	}

	queue := h.getTournamentQueueLocked(tournamentID)
	queue.mu.Lock()
	defer queue.mu.Unlock()

	for _, queued := range queue.players {
		if queued.ID == client.ID {
			h.sendErrorLocked(client, "already_queued", "player already in tournament queue")
			return
		}
	}

	queue.players = append(queue.players, client)
	client.QueueType = "tournament"
	client.TournamentID = tournamentID
	client.TournamentParticipantID = participant.ID
	client.TournamentExpectedOpponentID = eligibility.OpponentPlayerID
	client.EnqueuedAt = time.Now()

	h.tryMatchTournamentQueue(queue, tournamentID)
}

func (h *Hub) lookupTournamentQueueEligibility(playerID string, tournamentID uint) (*database.TournamentQueueEligibility, error) {
	dbConn, err := database.GetPostgresConnection()
	if err != nil {
		return nil, err
	}

	return database.GetTournamentQueueEligibility(dbConn, tournamentID, playerID)
}

func (h *Hub) getTournamentQueueLocked(tournamentID uint) *tournamentQueue {
	queue, ok := h.tournamentQueues[tournamentID]
	if !ok {
		queue = &tournamentQueue{}
		h.tournamentQueues[tournamentID] = queue
	}
	return queue
}

func (h *Hub) tryMatchBucket(bucket *ratingBucket) {
	for len(bucket.players) >= 2 {
		pA := bucket.players[0]
		pB := bucket.players[1]
		bucket.players = bucket.players[2:]

		validA := h.isClientActiveLocked(pA) && pA.ID != ""
		validB := h.isClientActiveLocked(pB) && pB.ID != ""
		if pA == pB || !validA || !validB {
			if validB && pA != pB {
				bucket.players = append([]*Client{pB}, bucket.players...)
			}
			if validA {
				bucket.players = append([]*Client{pA}, bucket.players...)
			}
			continue
		}

		pA.QueueType = ""
		pA.TournamentID = 0
		pB.QueueType = ""
		pB.TournamentID = 0
		h.startMatchLocked(pA, pB, nil)
	}
}

func (h *Hub) tryMatchTournamentQueue(queue *tournamentQueue, tournamentID uint) {
	for {
		matched := false

		for i := 0; i < len(queue.players); i++ {
			pA := queue.players[i]
			if pA == nil || !h.isClientActiveLocked(pA) || pA.ID == "" {
				queue.players = append(queue.players[:i], queue.players[i+1:]...)
				i--
				continue
			}
			if pA.TournamentID != tournamentID || strings.TrimSpace(pA.TournamentExpectedOpponentID) == "" {
				continue
			}

			j := -1
			for idx, candidate := range queue.players {
				if idx == i || candidate == nil {
					continue
				}
				if candidate.ID == pA.TournamentExpectedOpponentID {
					j = idx
					break
				}
			}
			if j < 0 {
				continue
			}

			pB := queue.players[j]
			if !h.isClientActiveLocked(pB) || pB.ID == "" || pB.TournamentID != tournamentID {
				continue
			}
			if pB.TournamentExpectedOpponentID != pA.ID {
				continue
			}

			if i > j {
				i, j = j, i
				pA, pB = pB, pA
			}
			queue.players = append(queue.players[:j], queue.players[j+1:]...)
			queue.players = append(queue.players[:i], queue.players[i+1:]...)

			pA.QueueType = ""
			pA.TournamentID = 0
			pA.TournamentParticipantID = 0
			pA.TournamentExpectedOpponentID = ""

			pB.QueueType = ""
			pB.TournamentID = 0
			pB.TournamentParticipantID = 0
			pB.TournamentExpectedOpponentID = ""

			h.startMatchLocked(pA, pB, &tournamentID)
			matched = true
			break
		}

		if !matched {
			return
		}
	}
}

func (h *Hub) startMatchLocked(pA, pB *Client, tournamentID *uint) {
	matchID := newMatchID()
	now := time.Now().UTC()
	targetCode := utils.PickTargetCode()
	pollutedCode := utils.PolluteCode(targetCode, pA.Rating)

	match := &Match{
		ID:           matchID,
		PlayerA:      pA,
		PlayerB:      pB,
		TournamentID: tournamentID,
		Status:       MatchPlaying,
		TargetCode:   targetCode,
		PollutedCode: pollutedCode,
		StartedAt:    now,
		LastSeqByID: map[string]int64{
			pA.ID: 0,
			pB.ID: 0,
		},
		PlayerABuffer: pollutedCode,
		PlayerBBuffer: pollutedCode,
		spectators:    make(map[int]chan SpectatorEvent),
	}
	h.matches[matchID] = match
	pA.MatchID = matchID
	pB.MatchID = matchID

	startA := GameStartPayload{
		MatchID:        matchID,
		OpponentID:     pB.ID,
		OpponentName:   pB.DisplayName,
		OpponentAvatar: pB.AvatarURL,
		OpponentRating: pB.Rating,
		RoundDurationS: roundDurationInSeconds,
		Role:           "A",
		StartedAt:      now.Unix(),
		TargetCode:     targetCode,
		PollutedCode:   pollutedCode,
	}
	startB := GameStartPayload{
		MatchID:        matchID,
		OpponentID:     pA.ID,
		OpponentName:   pA.DisplayName,
		OpponentAvatar: pA.AvatarURL,
		OpponentRating: pA.Rating,
		RoundDurationS: roundDurationInSeconds,
		Role:           "B",
		StartedAt:      now.Unix(),
		TargetCode:     targetCode,
		PollutedCode:   pollutedCode,
	}
	h.sendLocked(pA, MsgGameStart, matchID, pA.ID, 0, startA)
	h.sendLocked(pB, MsgGameStart, matchID, pB.ID, 0, startB)

	if tournamentID != nil {
		tid := *tournamentID
		playerAID := pA.ID
		playerBID := pB.ID
		go func() {
			dbConn, err := database.GetPostgresConnection()
			if err != nil {
				return
			}
			_ = database.MarkTournamentMatchPlaying(dbConn, tid, matchID, playerAID, playerBID)
		}()
	}

	go h.runRoundTimeout(matchID)
}

func (h *Hub) removeFromQueueLocked(target *Client) {
	if target.MatchID != "" {
		return
	}

	if target.QueueType == "tournament" && target.TournamentID > 0 {
		queue := h.tournamentQueues[target.TournamentID]
		if queue != nil {
			queue.mu.Lock()
			for i, c := range queue.players {
				if c == target {
					queue.players = append(queue.players[:i], queue.players[i+1:]...)
					break
				}
			}
			queue.mu.Unlock()
		}
		target.QueueType = ""
		target.TournamentID = 0
		target.TournamentParticipantID = 0
		target.TournamentExpectedOpponentID = ""
		return
	}

	bucketIdx := target.Rating
	if bucketIdx < 0 || bucketIdx >= numBuckets {
		bucketIdx = 0
	}

	bucket := h.waitingBuckets[bucketIdx]
	if bucket == nil {
		return
	}

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	for i, c := range bucket.players {
		if c == target {
			bucket.players = append(bucket.players[:i], bucket.players[i+1:]...)
			break
		}
	}
	target.QueueType = ""
	target.TournamentID = 0
	target.TournamentParticipantID = 0
	target.TournamentExpectedOpponentID = ""
}

func (h *Hub) isClientActiveLocked(client *Client) bool {
	if client == nil || client.closed {
		return false
	}
	_, ok := h.clients[client]
	return ok
}

func (h *Hub) runMatchExpansion() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		h.expandStaleMatches()
	}
}

func (h *Hub) runRoundTimeout(matchID string) {
	timer := time.NewTimer(roundDuration + countdownGraceDuration)
	defer timer.Stop()

	<-timer.C

	h.finishMatchAsDraw(matchID, "timeout_draw")
}

func (h *Hub) expandStaleMatches() {
	h.mu.Lock()
	defer h.mu.Unlock()

	now := time.Now()

	for i := 0; i < numBuckets; i++ {
		src := h.waitingBuckets[i]
		if src == nil {
			continue
		}

		src.mu.Lock()
		if len(src.players) == 0 {
			src.mu.Unlock()
			continue
		}

		oldest := src.players[0]
		wait := now.Sub(oldest.EnqueuedAt)

		// TODO: use 30 second wait
		if wait < 5*time.Second {
			src.mu.Unlock()
			continue
		}

		spread := int(wait / (5 * time.Second))
		if spread > 5 {
			spread = 5
		}
		if spread < 1 {
			spread = 1
		}

		src.mu.Unlock()

		for delta := 1; delta <= spread; delta++ {
			for _, j := range []int{i - delta, i + delta} {
				if j < 0 || j >= numBuckets {
					continue
				}
				if j == i {
					continue
				}

				dst := h.waitingBuckets[j]
				if dst == nil {
					continue
				}

				dst.mu.Lock()
				if len(dst.players) == 0 {
					dst.mu.Unlock()
					continue
				}

				candidate := dst.players[0]
				dst.players = dst.players[1:]
				dst.mu.Unlock()

				src.mu.Lock()
				src.players = append(src.players, candidate)
				h.tryMatchBucket(src)
				src.mu.Unlock()
				break
			}
		}
	}
}
