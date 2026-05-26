package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Match struct {
	gorm.Model
	MatchID               uuid.UUID `json:"match_id"`
	PlayerAID             *uint     `json:"player_a_id" gorm:"index"`
	PlayerBID             *uint     `json:"player_b_id" gorm:"index"`
	PlayerA               *User     `json:"player_a"`
	PlayerB               *User     `json:"player_b"`
	PlayerAGuestID        *string   `json:"player_a_guest_id" gorm:"size:64;index"`
	PlayerBGuestID        *string   `json:"player_b_guest_id" gorm:"size:64;index"`
	PlayerAGuestName      *string   `json:"player_a_guest_name" gorm:"size:64"`
	PlayerBGuestName      *string   `json:"player_b_guest_name" gorm:"size:64"`
	PlayerAGuestAvatarURL *string   `json:"player_a_guest_avatar_url" gorm:"size:512"`
	PlayerBGuestAvatarURL *string   `json:"player_b_guest_avatar_url" gorm:"size:512"`
	TargetCode            string    `json:"target_code" gorm:"type:text"`
	PollutedCode          string    `json:"polluted_code" gorm:"type:text"`
	WinnerID              uint      `json:"winner_id"`
	Outcome               string    `json:"outcome" gorm:"default:'decisive';index"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
	FinishedAt            time.Time `json:"finished_at"`
}
