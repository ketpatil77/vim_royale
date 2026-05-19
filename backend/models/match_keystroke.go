package models

import (
	"encoding/json"
	"time"
)

type MatchKeystroke struct {
	ID        uint            `gorm:"primaryKey"`
	MatchID   string          `gorm:"index;uniqueIndex:idx_match_player"`
	PlayerID  string          `gorm:"uniqueIndex:idx_match_player"`
	Sent      json.RawMessage `gorm:"type:jsonb"`
	Received  json.RawMessage `gorm:"type:jsonb"`
	CreatedAt time.Time
}

func (MatchKeystroke) TableName() string {
	return "match_keystrokes"
}