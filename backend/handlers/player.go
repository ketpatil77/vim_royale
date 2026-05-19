package handlers

import (
	"strconv"
	database "vim_royale/backend/db"
	"vim_royale/backend/models"

	"github.com/gin-gonic/gin"
)

type UserMatchHistoryEntry struct {
	MatchID             string `json:"matchId"`
	FinishedAt          int64  `json:"finishedAt"`
	OpponentUsername    string `json:"opponentUsername"`
	OpponentDisplayName string `json:"opponentDisplayName"`
	OpponentAvatarURL   string `json:"opponentAvatarUrl"`
	IsWinner            bool   `json:"isWinner"`
	ReplayAvailable     bool   `json:"replayAvailable"`
}

type UserMatchesResponse struct {
	Items      []UserMatchHistoryEntry `json:"items"`
	Page       int                     `json:"page"`
	PageSize   int                     `json:"pageSize"`
	Total      int64                   `json:"total"`
	TotalPages int                     `json:"totalPages"`
}

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
		"id":          user.ID,
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
		"id":          updatedUser.ID,
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
	response := []map[string]interface{}{}
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

func GetUserMatches(c *gin.Context) {
	username := c.Param("username")
	if username == "" {
		c.JSON(400, gin.H{"error": "Username is required"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get database connection"})
		return
	}

	user, err := database.GetUserFromUsername(db, username)
	if err != nil {
		c.JSON(404, gin.H{"error": "User not found"})
		return
	}

	page := 1
	if rawPage := c.DefaultQuery("page", "1"); rawPage != "" {
		if parsedPage, pErr := strconv.Atoi(rawPage); pErr == nil && parsedPage > 0 {
			page = parsedPage
		}
	}

	pageSize := 5
	if rawPageSize := c.DefaultQuery("pageSize", "5"); rawPageSize != "" {
		if parsedPageSize, psErr := strconv.Atoi(rawPageSize); psErr == nil {
			if parsedPageSize < 1 {
				parsedPageSize = 1
			}
			if parsedPageSize > 20 {
				parsedPageSize = 20
			}
			pageSize = parsedPageSize
		}
	}

	total, err := database.CountMatchesForUser(db, user.ID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to count matches"})
		return
	}

	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(pageSize) - 1) / int64(pageSize))
	}

	if totalPages > 0 && page > totalPages {
		page = totalPages
	}

	offset := (page - 1) * pageSize

	matches, err := database.GetRecentMatchesForUserPaged(db, user.ID, pageSize, offset)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to load matches"})
		return
	}

	matchIDs := make([]string, 0, len(matches))
	for _, match := range matches {
		matchIDs = append(matchIDs, match.MatchID.String())
	}

	replayAvailability, err := database.GetReplayAvailabilityByMatchIDs(db, matchIDs)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to load replay metadata"})
		return
	}

	response := make([]UserMatchHistoryEntry, 0, len(matches))
	for _, match := range matches {
		opponent := match.PlayerB
		if match.PlayerBID == user.ID {
			opponent = match.PlayerA
		}

		finishedAt := match.FinishedAt.Unix()
		if match.FinishedAt.IsZero() {
			finishedAt = match.UpdatedAt.Unix()
		}

		matchID := match.MatchID.String()
		response = append(response, UserMatchHistoryEntry{
			MatchID:             matchID,
			FinishedAt:          finishedAt,
			OpponentUsername:    opponent.Username,
			OpponentDisplayName: opponent.DisplayName,
			OpponentAvatarURL:   opponent.AvatarURL,
			IsWinner:            match.WinnerID == user.ID,
			ReplayAvailable:     replayAvailability[matchID],
		})
	}

	c.JSON(200, UserMatchesResponse{
		Items:      response,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	})
}
