package handlers

import (
	"vim_royale/backend/auth"
	database "vim_royale/backend/db"
	"vim_royale/backend/middleware"

	"github.com/gin-gonic/gin"
)

func AuthGoogleHandler(c *gin.Context) {
	auth.GoogleLogin(c)
}

func AuthGoogleCallbackHandler(c *gin.Context) {
	auth.GoogleCallback(c)
}

func AuthGitHubHandler(c *gin.Context) {
	auth.GitHubLogin(c)
}

func AuthGitHubCallbackHandler(c *gin.Context) {
	auth.GitHubCallback(c)
}

func AuthMeHandler(c *gin.Context) {
	provider, _ := c.Get("provider")
	providerID, _ := c.Get("providerID")

	dbConn, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(500, gin.H{"error": "database connection failed"})
		return
	}

	user, err := database.GetUserFromProvider(dbConn, provider.(string), providerID.(string))
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get user"})
		return
	}
	userResponse := gin.H{
		"id":           user.ID,
		"provider":    user.Provider,
		"providerId":  user.ProviderID,
		"email":       user.Email,
		"avatarUrl":   user.AvatarURL,
		"githubId":    user.GithubID,
		"twitterId":   user.TwitterID,
		"discordId":   user.DiscordID,
		"displayName": user.DisplayName,
		"matches":     user.Matches,
		"won":         user.Won,
		"lost":        user.Lost,
		"rating":      user.Rating,
		"lastActive":  user.LastActive,
	}

	c.JSON(200, userResponse)

}

func AuthLogoutHandler(c *gin.Context) {
	c.SetCookie("token", "", -1, "/", "", false, true)
	c.JSON(200, gin.H{"message": "logged out"})
}

func AuthMiddleware() gin.HandlerFunc {
	return middleware.AuthRequired()
}
