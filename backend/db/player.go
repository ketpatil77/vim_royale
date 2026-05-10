package database

import (
	"time"

	"vim_royale/backend/models"

	"gorm.io/gorm"
)

func FindOrCreateUser(provider, providerID, email, displayName, avatarURL string) (*models.User, error) {
	database, err := GetPostgresConnection()
	if err != nil {
		return nil, err
	}

	var user models.User
	result := database.Where("provider = ? AND provider_id = ?", provider, providerID).First(&user)

	if result.Error == nil {
		return &user, nil
	}

	username, err := CreateUniqueUsername(database)
	if err != nil {
		return nil, err
	}

	user = models.User{
		Username:    username,
		Provider:    provider,
		ProviderID:  providerID,
		Email:       email,
		DisplayName: displayName,
		AvatarURL:   avatarURL,
	}

	if err := database.Create(&user).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

func UpdateUserStats(db *gorm.DB, user *models.User, won bool) error {
	user.LastActive = time.Now()
	if won {
		user.Won++
	} else {
		user.Lost++
	}
	user.Matches += 1
	return db.Save(user).Error
}

func GetUserFromProvider(db *gorm.DB, provider, providerID string) (*models.User, error) {
	var user models.User
	if err := db.Where("provider = ? AND provider_id = ?", provider, providerID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func GetUserFromUsername(db *gorm.DB, username string) (*models.User, error) {
	var user models.User
	if err := db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func UpdateUserProfilePartial(db *gorm.DB, user *models.User, req *models.UpdateUserRequest) error {
	updates := map[string]interface{}{}

	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.AvatarURL != nil {
		updates["avatar_url"] = *req.AvatarURL
	}
	if req.GitHubID != nil {
		updates["github_id"] = *req.GitHubID
	}
	if req.TwitterID != nil {
		updates["twitter_id"] = *req.TwitterID
	}
	if req.DiscordID != nil {
		updates["discord_id"] = *req.DiscordID
	}

	if len(updates) == 0 {
		return nil
	}

	return db.Model(user).Updates(updates).Error
}

func GetLeaderboard(db *gorm.DB) ([]models.User, error) {
	var users []models.User
	if err := db.Order("rating DESC").Limit(10).Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}
