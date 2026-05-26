package handlers

import (
	"encoding/json"
	"strings"
	database "vim_royale/backend/db"
	"vim_royale/backend/models"

	"github.com/gin-gonic/gin"
)

type ReplayPlayerData struct {
	PlayerID    string          `json:"playerId"`
	Username    string          `json:"username"`
	DisplayName string          `json:"displayName"`
	AvatarURL   string          `json:"avatarUrl"`
	Sent        json.RawMessage `json:"sent"`
	Received    json.RawMessage `json:"received"`
}

func replayPlayerFromMatchSide(match *models.Match, side string) ReplayPlayerData {
	data := ReplayPlayerData{
		PlayerID:    "",
		Username:    "",
		DisplayName: "Unknown",
		AvatarURL:   "",
	}

	switch side {
	case "A":
		if match.PlayerA != nil {
			data.Username = match.PlayerA.Username
			data.DisplayName = match.PlayerA.DisplayName
			data.AvatarURL = match.PlayerA.AvatarURL
		} else {
			if match.PlayerAGuestName != nil && strings.TrimSpace(*match.PlayerAGuestName) != "" {
				data.DisplayName = strings.TrimSpace(*match.PlayerAGuestName)
			}
			if match.PlayerAGuestAvatarURL != nil {
				data.AvatarURL = strings.TrimSpace(*match.PlayerAGuestAvatarURL)
			}
		}
	case "B":
		if match.PlayerB != nil {
			data.Username = match.PlayerB.Username
			data.DisplayName = match.PlayerB.DisplayName
			data.AvatarURL = match.PlayerB.AvatarURL
		} else {
			if match.PlayerBGuestName != nil && strings.TrimSpace(*match.PlayerBGuestName) != "" {
				data.DisplayName = strings.TrimSpace(*match.PlayerBGuestName)
			}
			if match.PlayerBGuestAvatarURL != nil {
				data.AvatarURL = strings.TrimSpace(*match.PlayerBGuestAvatarURL)
			}
		}
	}

	if strings.TrimSpace(data.DisplayName) == "" {
		data.DisplayName = "Unknown"
	}
	return data
}

func replayIdentityForKeystrokes(match *models.Match, side string) string {
	switch side {
	case "A":
		if match.PlayerA != nil {
			return strings.TrimSpace(match.PlayerA.Provider + ":" + match.PlayerA.ProviderID)
		}
		if match.PlayerAGuestID != nil {
			return strings.TrimSpace(*match.PlayerAGuestID)
		}
	case "B":
		if match.PlayerB != nil {
			return strings.TrimSpace(match.PlayerB.Provider + ":" + match.PlayerB.ProviderID)
		}
		if match.PlayerBGuestID != nil {
			return strings.TrimSpace(*match.PlayerBGuestID)
		}
	}
	return ""
}

type MatchReplayResponse struct {
	MatchID      string           `json:"matchId"`
	WinnerID     uint             `json:"winnerId"`
	FinishedAt   int64            `json:"finishedAt"`
	TargetCode   string           `json:"targetCode"`
	PollutedCode string           `json:"pollutedCode"`
	PlayerA      ReplayPlayerData `json:"playerA"`
	PlayerB      ReplayPlayerData `json:"playerB"`
}

func GetMatchReplay(c *gin.Context) {
	matchID := c.Param("matchId")
	if matchID == "" {
		c.JSON(400, gin.H{"error": "Match ID is required"})
		return
	}

	dbConn, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get database connection"})
		return
	}

	match, err := database.GetMatchByMatchID(dbConn, matchID)
	if err != nil {
		c.JSON(404, gin.H{"error": "Match not found"})
		return
	}

	keystrokes, err := database.GetMatchKeystrokesByMatchID(dbConn, matchID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get keystrokes"})
		return
	}

	playerAData := replayPlayerFromMatchSide(match, "A")
	playerBData := replayPlayerFromMatchSide(match, "B")
	playerAID := replayIdentityForKeystrokes(match, "A")
	playerBID := replayIdentityForKeystrokes(match, "B")
	playerAData.PlayerID = "player_a"
	playerBData.PlayerID = "player_b"

	for _, ks := range keystrokes {
		if ks.PlayerID == playerAID {
			if len(ks.Sent) > 0 {
				playerAData.Sent = ks.Sent
			}
			if len(ks.Received) > 0 && len(playerBData.Sent) == 0 {
				// Legacy/current storage often keeps opponent stream in "received".
				playerBData.Sent = ks.Received
			}
			playerAData.Received = ks.Received
		} else if ks.PlayerID == playerBID {
			if len(ks.Sent) > 0 {
				playerBData.Sent = ks.Sent
			}
			if len(ks.Received) > 0 && len(playerAData.Sent) == 0 {
				playerAData.Sent = ks.Received
			}
			playerBData.Received = ks.Received
		}
	}

	finishedAt := match.FinishedAt.Unix()
	if match.FinishedAt.IsZero() {
		finishedAt = match.UpdatedAt.Unix()
	}

	response := MatchReplayResponse{
		MatchID:      matchID,
		WinnerID:     match.WinnerID,
		FinishedAt:   finishedAt,
		TargetCode:   match.TargetCode,
		PollutedCode: match.PollutedCode,
		PlayerA:      playerAData,
		PlayerB:      playerBData,
	}

	c.JSON(200, response)
}
