package models

import (
	"time"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Provider     string    `gorm:"size:20;not null" json:"provider"`
	ProviderID   string    `gorm:"size:255;not null;uniqueIndex:idx_provider_providerid" json:"providerId"`
	Email        string    `gorm:"size:255" json:"email"`
	DisplayName string    `gorm:"size:255" json:"displayName"`
	AvatarURL    string    `gorm:"size:512" json:"avatarUrl"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func (User) TableName() string {
	return "users"
}