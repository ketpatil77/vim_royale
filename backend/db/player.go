package db

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	UserID      uuid.UUID
	Provider    string
	ProviderID  string
	DisplayName string
	Email       string
	AvatarURL   string
	GithubID    string
	DiscordID   string
	TwitterID   string
	Username    string
	Matches     int
	Won         int
	Lost        int
	CreatedAt   time.Time
	LastActive  time.Time
}

func CreateUser(db *gorm.DB, username string) (*User, error) {
	user := &User{
		UserID:     uuid.New(),
		Username:   username,
		CreatedAt:  time.Now(),
		LastActive: time.Now(),
	}
	if err := db.Create(user).Error; err != nil {
		return nil, err
	}
	return user, nil
}

func UpdateUser(db *gorm.DB, user *User, won bool) error {
	user.LastActive = time.Now()
	if won {
		user.Won++
	} else {
		user.Lost++
	}
	user.Matches += 1
	return db.Save(user).Error
}
