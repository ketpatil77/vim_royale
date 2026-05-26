package models

import (
	"time"

	"gorm.io/gorm"
)

type TimedScoreRun struct {
	gorm.Model
	RunTokenHash  string     `json:"-" gorm:"type:char(64);uniqueIndex"`
	Difficulty    string     `json:"difficulty" gorm:"size:24;index"`
	OwnerUserID   *uint      `json:"ownerUserId,omitempty" gorm:"index"`
	OwnerUser     *User      `json:"-"`
	GuestID       string     `json:"guestId" gorm:"size:64;index"`
	StartedAt     time.Time  `json:"startedAt" gorm:"index"`
	CompletedAt   *time.Time `json:"completedAt,omitempty" gorm:"index"`
	ConsumedAt    *time.Time `json:"consumedAt,omitempty" gorm:"index"`
	ExpiresAt     time.Time  `json:"expiresAt" gorm:"index"`
	ClaimedUserID *uint      `json:"claimedUserId,omitempty" gorm:"index"`
	ClaimedUser   *User      `json:"-"`
}

func (TimedScoreRun) TableName() string {
	return "timed_score_runs"
}
