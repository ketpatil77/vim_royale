package handlers

import (
	"encoding/json"
	"time"
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

	playerAID := match.PlayerA.Provider + ":" + match.PlayerA.ProviderID
	playerBID := match.PlayerB.Provider + ":" + match.PlayerB.ProviderID

	if len(keystrokes) == 0 {
		legacyCandidates, legacyErr := database.GetRecentKeystrokesForPlayers(dbConn, []string{playerAID, playerBID}, 80)
		if legacyErr == nil && len(legacyCandidates) > 0 {
			targetTime := match.FinishedAt
			if targetTime.IsZero() {
				targetTime = match.UpdatedAt
			}

			bestIdx := 0
			bestDiff := time.Duration(1<<63 - 1)
			for i, row := range legacyCandidates {
				diff := row.CreatedAt.Sub(targetTime)
				if diff < 0 {
					diff = -diff
				}
				if diff < bestDiff {
					bestDiff = diff
					bestIdx = i
				}
			}

			keystrokes = []models.MatchKeystroke{legacyCandidates[bestIdx]}
		}
	}

	playerAData := ReplayPlayerData{
		PlayerID:    playerAID,
		Username:    match.PlayerA.Username,
		DisplayName: match.PlayerA.DisplayName,
		AvatarURL:   match.PlayerA.AvatarURL,
	}
	playerBData := ReplayPlayerData{
		PlayerID:    playerBID,
		Username:    match.PlayerB.Username,
		DisplayName: match.PlayerB.DisplayName,
		AvatarURL:   match.PlayerB.AvatarURL,
	}

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
		} else {
			// Fallback row not tied to the exact match ID (older saved format).
			// Keep data useful by assigning this row to player A and mirroring received to player B.
			if len(ks.Sent) > 0 && len(playerAData.Sent) == 0 {
				playerAData.Sent = ks.Sent
			}
			if len(ks.Received) > 0 && len(playerBData.Sent) == 0 {
				playerBData.Sent = ks.Received
			}
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
