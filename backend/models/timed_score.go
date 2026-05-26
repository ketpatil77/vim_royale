package models

import (
	"time"

	"gorm.io/gorm"
)

type TimedScore struct {
	gorm.Model
	UserID      uint      `json:"userId" gorm:"index"`
	User        User      `json:"-"`
	Difficulty  string    `json:"difficulty" gorm:"size:24;index"`
	TimeSeconds int       `json:"timeSeconds"`
	CompletedAt time.Time `json:"completedAt" gorm:"index"`
}

func (TimedScore) TableName() string {
	return "timed_scores"
}
