package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Provider    string    `json:"provider"`
	ProviderID  string    `json:"provider_id"`
	DisplayName string    `json:"display_name"`
	Email       string    `json:"email"`
	AvatarURL   string    `json:"avatar_url"`
	GithubID    string    `json:"github_id"`
	DiscordID   string    `json:"discord_id"`
	TwitterID   string    `json:"twitter_id"`
	Username    string    `json:"username"`
	Matches     int       `json:"matches"      gorm:"default:0"`
	Won         int       `json:"won"          gorm:"default:0"`
	Lost        int       `json:"lost"         gorm:"default:0"`
	LastActive  time.Time `json:"last_active"`
	Rating      float64   `json:"rating"       gorm:"default:1500"`
}

func (User) TableName() string {
	return "users"
}
