package handlers

import (
	"errors"
	"strings"
	"vim_royale/backend/auth"
	database "vim_royale/backend/db"
	"vim_royale/backend/middleware"
	"vim_royale/backend/models"

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
	user, err := fetchAuthedUser(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get user"})
		return
	}
	userResponse := gin.H{
		"id":          user.ID,
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

func GetMyVimKeybindings(c *gin.Context) {
	user, err := fetchAuthedUser(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get user"})
		return
	}

	c.JSON(200, models.VimKeybindingsResponse{
		Mappings: models.DecodeVimKeybindings(user.VimKeybindingsJSON),
		Warnings: []models.VimKeybindingWarning{},
		Version:  models.VimKeybindingsVersion,
	})
}

func UpdateMyVimKeybindings(c *gin.Context) {
	user, err := fetchAuthedUser(c)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get user"})
		return
	}

	var req models.UpdateVimKeybindingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}

	var mappings []models.VimKeybindingMapping
	warnings := make([]models.VimKeybindingWarning, 0)

	switch {
	case req.Source != nil:
		parsedMappings, parseWarnings := models.ParseVimKeybindingSource(*req.Source)
		mappings = parsedMappings
		warnings = append(warnings, parseWarnings...)
	case req.Mappings != nil:
		mappings = req.Mappings
	default:
		mappings = []models.VimKeybindingMapping{}
	}

	normalizedMappings, normalizeWarnings := models.NormalizeVimKeybindingMappings(mappings)
	warnings = append(warnings, normalizeWarnings...)
	if req.Source != nil && strings.TrimSpace(*req.Source) != "" && len(normalizedMappings) == 0 {
		c.JSON(400, gin.H{
			"error":    "no valid mappings found in source",
			"warnings": warnings,
		})
		return
	}

	dbConn, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(500, gin.H{"error": "database connection failed"})
		return
	}

	if err := database.UpdateUserVimKeybindings(dbConn, user, normalizedMappings); err != nil {
		c.JSON(500, gin.H{"error": "failed to update keybindings"})
		return
	}

	c.JSON(200, models.VimKeybindingsResponse{
		Mappings: normalizedMappings,
		Warnings: warnings,
		Version:  models.VimKeybindingsVersion,
	})
}

func AuthLogoutHandler(c *gin.Context) {
	auth.ClearAuthCookie(c)
	c.JSON(200, gin.H{"message": "logged out"})
}

func AuthMiddleware() gin.HandlerFunc {
	return middleware.AuthRequired()
}

func fetchAuthedUser(c *gin.Context) (*models.User, error) {
	providerValue, exists := c.Get("provider")
	if !exists {
		return nil, errors.New("missing auth provider")
	}
	provider, ok := providerValue.(string)
	if !ok || strings.TrimSpace(provider) == "" {
		return nil, errors.New("invalid auth provider")
	}

	providerIDValue, exists := c.Get("providerID")
	if !exists {
		return nil, errors.New("missing auth provider id")
	}
	providerID, ok := providerIDValue.(string)
	if !ok || strings.TrimSpace(providerID) == "" {
		return nil, errors.New("invalid auth provider id")
	}

	dbConn, err := database.GetPostgresConnection()
	if err != nil {
		return nil, err
	}

	user, err := database.GetUserFromProvider(dbConn, provider, providerID)
	if err != nil {
		return nil, err
	}
	user.VimKeybindingsJSON = strings.TrimSpace(user.VimKeybindingsJSON)
	return user, nil
}
