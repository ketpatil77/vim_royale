package handlers

import (
	"strconv"
	database "vim_royale/backend/db"
	"vim_royale/backend/models"
	"vim_royale/backend/services"

	"github.com/gin-gonic/gin"
)

type UserMatchHistoryEntry struct {
	MatchID             string `json:"matchId"`
	FinishedAt          int64  `json:"finishedAt"`
	OpponentUsername    string `json:"opponentUsername"`
	OpponentDisplayName string `json:"opponentDisplayName"`
	OpponentAvatarURL   string `json:"opponentAvatarUrl"`
	OpponentIsGuest     bool   `json:"opponentIsGuest"`
	IsWinner            bool   `json:"isWinner"`
	IsDraw              bool   `json:"isDraw"`
	ReplayAvailable     bool   `json:"replayAvailable"`
}

type UserMatchesResponse struct {
	Items      []UserMatchHistoryEntry `json:"items"`
	Page       int                     `json:"page"`
	PageSize   int                     `json:"pageSize"`
	Total      int64                   `json:"total"`
	TotalPages int                     `json:"totalPages"`
}

type UserLiveStatusResponse struct {
	IsLive      bool    `json:"isLive"`
	LiveMatchID *string `json:"liveMatchId"`
	LiveMode    *string `json:"liveMode"`
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

func GetLeaderboard(hub *services.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
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

		playerIDs := make([]string, 0, len(leaderboard))
		for _, user := range leaderboard {
			playerIDs = append(playerIDs, user.Provider+":"+user.ProviderID)
		}
		liveByPlayerID := hub.GetLiveMatchesForPlayers(playerIDs)

		response := []map[string]interface{}{}
		for _, user := range leaderboard {
			playerID := user.Provider + ":" + user.ProviderID
			live := liveByPlayerID[playerID]
			isLive := live.State == "playing"
			var liveMatchID *string
			var liveMode *string
			if isLive && live.MatchID != "" {
				liveMatchID = &live.MatchID
				mode := "multiplayer"
				liveMode = &mode
			}

			response = append(response, map[string]interface{}{
				"user_id":     user.ID,
				"username":    user.Username,
				"displayName": user.DisplayName,
				"rating":      user.Rating,
				"avatarUrl":   user.AvatarURL,
				"githubId":    user.GithubID,
				"twitterId":   user.TwitterID,
				"discordId":   user.DiscordID,
				"isLive":      isLive,
				"liveMatchId": liveMatchID,
				"liveMode":    liveMode,
			})
		}

		c.JSON(200, response)
	}
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
		isUserPlayerA := match.PlayerAID != nil && *match.PlayerAID == user.ID
		isUserPlayerB := match.PlayerBID != nil && *match.PlayerBID == user.ID

		opponentUsername := ""
		opponentDisplayName := "Unknown Opponent"
		opponentAvatarURL := ""
		opponentIsGuest := false

		if isUserPlayerA {
			if match.PlayerB != nil {
				opponentUsername = match.PlayerB.Username
				opponentDisplayName = match.PlayerB.DisplayName
				opponentAvatarURL = match.PlayerB.AvatarURL
			} else {
				opponentIsGuest = true
				if match.PlayerBGuestName != nil && *match.PlayerBGuestName != "" {
					opponentDisplayName = *match.PlayerBGuestName
				}
				if match.PlayerBGuestAvatarURL != nil {
					opponentAvatarURL = *match.PlayerBGuestAvatarURL
				}
			}
		} else if isUserPlayerB {
			if match.PlayerA != nil {
				opponentUsername = match.PlayerA.Username
				opponentDisplayName = match.PlayerA.DisplayName
				opponentAvatarURL = match.PlayerA.AvatarURL
			} else {
				opponentIsGuest = true
				if match.PlayerAGuestName != nil && *match.PlayerAGuestName != "" {
					opponentDisplayName = *match.PlayerAGuestName
				}
				if match.PlayerAGuestAvatarURL != nil {
					opponentAvatarURL = *match.PlayerAGuestAvatarURL
				}
			}
		}

		finishedAt := match.FinishedAt.Unix()
		if match.FinishedAt.IsZero() {
			finishedAt = match.UpdatedAt.Unix()
		}

		matchID := match.MatchID.String()
		isDraw := match.Outcome == "draw"
		response = append(response, UserMatchHistoryEntry{
			MatchID:             matchID,
			FinishedAt:          finishedAt,
			OpponentUsername:    opponentUsername,
			OpponentDisplayName: opponentDisplayName,
			OpponentAvatarURL:   opponentAvatarURL,
			OpponentIsGuest:     opponentIsGuest,
			IsWinner:            !isDraw && match.WinnerID == user.ID,
			IsDraw:              isDraw,
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

func GetUserLiveStatus(hub *services.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
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

		playerID := user.Provider + ":" + user.ProviderID
		matchID, mode, isLive := hub.GetLiveMatchForPlayer(playerID)

		var liveMatchID *string
		var liveMode *string
		if isLive {
			liveMatchID = &matchID
			liveMode = &mode
		}

		c.JSON(200, UserLiveStatusResponse{
			IsLive:      isLive,
			LiveMatchID: liveMatchID,
			LiveMode:    liveMode,
		})
	}
}
