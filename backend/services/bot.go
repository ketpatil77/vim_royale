package services

import (
	"encoding/json"
	"errors"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type Bot struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Avatar     string `json:"avatar"`
	Rating     int    `json:"rating"`
	Difficulty string `json:"difficulty"`
}

type TimedDelta struct {
	AfterMs int             `json:"afterMs"`
	Ops     json.RawMessage `json:"ops"`
}

type BotDeltaSequence struct {
	TargetCodeID string       `json:"targetCodeId,omitempty"`
	TargetCode   string       `json:"targetCode,omitempty"`
	FinishedAtMs int          `json:"finishedAtMs"`
	Deltas       []TimedDelta `json:"deltas"`
}

type BotDataFile struct {
	Bot       Bot                `json:"bot"`
	Sequences []BotDeltaSequence `json:"sequences"`
}

type BotMatch struct {
	BotID          string
	BotName        string
	BotAvatar      string
	BotRating      int
	PlayerID       string
	Sequence       BotDeltaSequence
	PlayerFinished bool
	BotFinished    bool
}

type BotManager struct {
	mu        sync.RWMutex
	bots      map[string]*Bot
	sequences map[string][]BotDeltaSequence
}

var botManager *BotManager

func InitBotManager(botsDir string) error {
	manager := &BotManager{
		bots:      make(map[string]*Bot),
		sequences: make(map[string][]BotDeltaSequence),
	}
	manager.loadDefaults()

	if botsDir != "" {
		if err := manager.loadFromDir(botsDir); err != nil {
			return err
		}
	}

	botManager = manager
	log.Printf("bot manager ready with %d bots", len(manager.bots))
	return nil
}

func (bm *BotManager) loadDefaults() {
	defaults := []*Bot{
		{ID: "pixelfox", Name: "PixelFox", Avatar: "https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_2.png", Rating: 800, Difficulty: "easy"},
		{ID: "cyberbadger", Name: "CyberBadger", Avatar: "https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_3.png", Rating: 1200, Difficulty: "medium"},
		{ID: "neontiger", Name: "NeonTiger", Avatar: "https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_4.png", Rating: 1600, Difficulty: "hard"},
		{ID: "quantumraven", Name: "QuantumRaven", Avatar: "https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_5.png", Rating: 2000, Difficulty: "expert"},
	}

	for _, bot := range defaults {
		b := *bot
		bm.bots[b.ID] = &b
	}
}

func (bm *BotManager) loadFromDir(botsDir string) error {
	entries, err := os.ReadDir(botsDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		filePath := filepath.Join(botsDir, entry.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			log.Printf("failed to read bot file %s: %v", filePath, err)
			continue
		}

		var payload BotDataFile
		if err := json.Unmarshal(data, &payload); err != nil {
			log.Printf("failed to parse bot file %s: %v", filePath, err)
			continue
		}

		if payload.Bot.ID == "" {
			log.Printf("skipping bot file %s: missing bot.id", filePath)
			continue
		}

		botCopy := payload.Bot
		bm.bots[payload.Bot.ID] = &botCopy
		bm.sequences[payload.Bot.ID] = payload.Sequences
		log.Printf("loaded bot file %s (%s, %d sequences)", entry.Name(), payload.Bot.Name, len(payload.Sequences))
	}

	return nil
}

func GetBot(botID string) *Bot {
	if botManager == nil {
		return nil
	}
	return botManager.GetBot(botID)
}

func (bm *BotManager) GetBot(botID string) *Bot {
	bm.mu.RLock()
	defer bm.mu.RUnlock()

	bot := bm.bots[botID]
	if bot == nil {
		return nil
	}
	copy := *bot
	return &copy
}

func (bm *BotManager) PickSequence(botID, targetCode string) BotDeltaSequence {
	bm.mu.RLock()
	sequences := bm.sequences[botID]
	bm.mu.RUnlock()

	if len(sequences) > 0 {
		matching := make([]BotDeltaSequence, 0, len(sequences))
		for _, seq := range sequences {
			if seq.TargetCode == "" || seq.TargetCode == targetCode {
				matching = append(matching, seq)
			}
		}
		if len(matching) > 0 {
			return matching[rand.Intn(len(matching))]
		}
		return sequences[rand.Intn(len(sequences))]
	}

	bot := bm.GetBot(botID)
	if bot == nil {
		return BotDeltaSequence{}
	}
	return buildFallbackSequence(*bot, targetCode)
}
