package handlers

import (
	database "vim_royale/backend/db"
	"vim_royale/backend/models"

	"github.com/gin-gonic/gin"
)

func GetUserFromUsername(c *gin.Context) {
	username := c.Param("username")
	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get database connection"})
		return
	}

	user, err := database.GetUserFromUsername(db, username)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get user"})
		return
	}

	c.JSON(200, gin.H{
		"id":           user.ID,
		"email":       user.Email,
		"displayName": user.DisplayName,
		"avatarUrl":   user.AvatarURL,
		"githubId":    user.GithubID,
		"twitterId":   user.TwitterID,
		"discordId":   user.DiscordID,
		"matches":     user.Matches,
		"won":         user.Won,
		"lost":        user.Lost,
		"rating":      user.Rating,
		"lastActive":  user.LastActive,
	})
}

func UpdateUserProfile(c *gin.Context) {
	provider, _ := c.Get("provider")
	providerID, _ := c.Get("providerID")

	var req models.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get database connection"})
		return
	}

	user, err := database.GetUserFromProvider(db, provider.(string), providerID.(string))
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get user"})
		return
	}

	if err := database.UpdateUserProfilePartial(db, user, &req); err != nil {
		c.JSON(500, gin.H{"error": "Failed to update user profile"})
		return
	}

	updatedUser, err := database.GetUserFromProvider(db, provider.(string), providerID.(string))
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch updated user"})
		return
	}

	c.JSON(200, gin.H{
		"id":           updatedUser.ID,
		"provider":    updatedUser.Provider,
		"providerId":  updatedUser.ProviderID,
		"email":       updatedUser.Email,
		"displayName": updatedUser.DisplayName,
		"avatarUrl":   updatedUser.AvatarURL,
		"githubId":    updatedUser.GithubID,
		"twitterId":   updatedUser.TwitterID,
		"discordId":   updatedUser.DiscordID,
		"matches":     updatedUser.Matches,
		"won":         updatedUser.Won,
		"lost":        updatedUser.Lost,
		"rating":      updatedUser.Rating,
		"lastActive":  updatedUser.LastActive,
	})
}

func GetLeaderboard(c *gin.Context) {
	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get database connection"})
		return
	}

	leaderboard, err := database.GetLeaderboard(db)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get leaderboard"})
		return
	}
	response := []map[string]interface{}{
	}
	for _, user := range leaderboard {
		response = append(response, map[string]interface{}{
			"user_id":     user.ID,
			"username":    user.Username,
			"displayName": user.DisplayName,
			"rating":      user.Rating,
			"avatarUrl":   user.AvatarURL,
			"githubId":    user.GithubID,
			"twitterId":   user.TwitterID,
			"discordId":   user.DiscordID,
		})
	}

	c.JSON(200, response)
}