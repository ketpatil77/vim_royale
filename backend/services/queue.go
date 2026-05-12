package services

import (
	"time"

	"vim_royale/backend/utils"
)

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
	client.EnqueuedAt = time.Now()

	h.tryMatchBucket(bucket)
}

func (h *Hub) tryMatchBucket(bucket *ratingBucket) {
	for len(bucket.players) >= 2 {
		pA := bucket.players[0]
		pB := bucket.players[1]
		bucket.players = bucket.players[2:]

		if pA == pB || pA.ID == "" || pB.ID == "" {
			continue
		}

		matchID := newMatchID()
		now := time.Now().UTC()
		targetCode := utils.PickTargetCode()
		pollutedCode := utils.PolluteCode(targetCode)

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

func (h *Hub) removeFromQueueLocked(target *Client) {
	if target.MatchID != "" {
		return
	}

	bucketIdx := target.Rating
	if bucketIdx < 0 || bucketIdx >= numBuckets {
		return
	}

	bucket := h.waitingBuckets[bucketIdx]
	if bucket == nil {
		return
	}

	bucket.mu.Lock()
	defer bucket.mu.Unlock()

	for i, c := range bucket.players {
		if c.ID == target.ID {
			bucket.players = append(bucket.players[:i], bucket.players[i+1:]...)
			return
		}
	}
}

func (h *Hub) runMatchExpansion() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		h.expandStaleMatches()
	}
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