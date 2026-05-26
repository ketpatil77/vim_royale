package models

import (
	"time"

	"gorm.io/gorm"
)

type GuestSession struct {
	gorm.Model
	GuestID          string     `json:"guestId" gorm:"size:64;uniqueIndex"`
	DisplayName      string     `json:"displayName" gorm:"size:64"`
	SessionTokenHash string     `json:"-" gorm:"type:char(64);uniqueIndex"`
	ExpiresAt        time.Time  `json:"expiresAt" gorm:"index"`
	LastSeenAt       time.Time  `json:"lastSeenAt" gorm:"index"`
	RevokedAt        *time.Time `json:"revokedAt,omitempty"`
}

func (GuestSession) TableName() string {
	return "guest_sessions"
}
