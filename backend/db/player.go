package database

import (
	"time"

	"vim_royale/backend/models"

	"gorm.io/gorm"
)

func CreateUser(db *gorm.DB, username string) (*models.User, error) {
	user := &models.User{
		Username:   username,
		LastActive: time.Now(),
	}
	if err := db.Create(user).Error; err != nil {
		return nil, err
	}
	return user, nil
}

func UpdateUser(db *gorm.DB, user *models.User, won bool) error {
	user.LastActive = time.Now()
	if won {
		user.Won++
	} else {
		user.Lost++
	}
	user.Matches += 1
	return db.Save(user).Error
}
