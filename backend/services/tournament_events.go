package services

import (
	"sync"
	"time"
)

type TournamentEvent struct {
	Type         string `json:"type"`
	TournamentID uint   `json:"tournamentId"`
	TS           int64  `json:"ts"`
}

type tournamentEventBus struct {
	mu   sync.RWMutex
	subs map[uint]map[chan TournamentEvent]struct{}
}

var globalTournamentEventBus = &tournamentEventBus{
	subs: make(map[uint]map[chan TournamentEvent]struct{}),
}

func PublishTournamentEvent(tournamentID uint, eventType string) {
	if tournamentID == 0 || eventType == "" {
		return
	}

	event := TournamentEvent{
		Type:         eventType,
		TournamentID: tournamentID,
		TS:           time.Now().UTC().Unix(),
	}

	globalTournamentEventBus.mu.RLock()
	subscribers := globalTournamentEventBus.subs[tournamentID]
	channels := make([]chan TournamentEvent, 0, len(subscribers))
	for ch := range subscribers {
		channels = append(channels, ch)
	}
	globalTournamentEventBus.mu.RUnlock()

	for _, ch := range channels {
		select {
		case ch <- event:
		default:
			// Slow subscribers should not block tournament event publishing.
		}
	}
}

func SubscribeTournamentEvents(tournamentID uint) (<-chan TournamentEvent, func()) {
	ch := make(chan TournamentEvent, 16)
	if tournamentID == 0 {
		close(ch)
		return ch, func() {}
	}

	globalTournamentEventBus.mu.Lock()
	if _, ok := globalTournamentEventBus.subs[tournamentID]; !ok {
		globalTournamentEventBus.subs[tournamentID] = make(map[chan TournamentEvent]struct{})
	}
	globalTournamentEventBus.subs[tournamentID][ch] = struct{}{}
	globalTournamentEventBus.mu.Unlock()

	unsubscribe := func() {
		globalTournamentEventBus.mu.Lock()
		defer globalTournamentEventBus.mu.Unlock()

		subscribers, ok := globalTournamentEventBus.subs[tournamentID]
		if !ok {
			return
		}
		if _, exists := subscribers[ch]; exists {
			delete(subscribers, ch)
			close(ch)
		}
		if len(subscribers) == 0 {
			delete(globalTournamentEventBus.subs, tournamentID)
		}
	}

	return ch, unsubscribe
}
