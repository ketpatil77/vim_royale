package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Match struct {
	gorm.Model
	MatchID      uuid.UUID `json:"match_id"`
	PlayerAID    uint      `json:"player_a_id"`
	PlayerBID    uint      `json:"player_b_id"`
	PlayerA      User      `json:"player_a"`
	PlayerB      User      `json:"player_b"`
	TargetCode   string    `json:"target_code" gorm:"type:text"`
	PollutedCode string    `json:"polluted_code" gorm:"type:text"`
	WinnerID     uint      `json:"winner_id"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	FinishedAt   time.Time `json:"finished_at"`
}
