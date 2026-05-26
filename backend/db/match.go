package database

import (
	"encoding/json"
	"strings"
	"time"
	"vim_royale/backend/models"
	"vim_royale/backend/utils"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func CreateMatchAndSendRatingDelta(db *gorm.DB, winnerID, loserID, targetCode, pollutedCode string) (matchID string, winnerDelta, loserDelta, winnerNewRating, loserNewRating float64, err error) {
	winner, err := findUserByPlayerID(db, winnerID)
	if err != nil {
		return "", 0, 0, 0, 0, err
	}
	loser, err := findUserByPlayerID(db, loserID)
	if err != nil {
		return "", 0, 0, 0, 0, err
	}

	oldWinnerRating := winner.Rating
	oldLoserRating := loser.Rating

	match := &models.Match{
		MatchID:      uuid.New(),
		PlayerAID:    &winner.ID,
		PlayerBID:    &loser.ID,
		PlayerA:      winner,
		PlayerB:      loser,
		TargetCode:   targetCode,
		PollutedCode: pollutedCode,
		WinnerID:     winner.ID,
		Outcome:      "decisive",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		FinishedAt:   time.Now(),
	}
	if err := db.Create(match).Error; err != nil {
		return "", 0, 0, 0, 0, err
	}

	newWinnerRating, newLoserRating := utils.CalculateElo(winner.Rating, loser.Rating, true)

	winner.Rating = newWinnerRating
	loser.Rating = newLoserRating

	if err := UpdateUserStats(db, winner, true); err != nil {
		return "", 0, 0, 0, 0, err
	}
	if err := UpdateUserStats(db, loser, false); err != nil {
		return "", 0, 0, 0, 0, err
	}

	return match.MatchID.String(), winner.Rating - oldWinnerRating, loser.Rating - oldLoserRating, winner.Rating, loser.Rating, nil
}

func ApplyMixedMatchRatingDelta(db *gorm.DB, playerID string, opponentRating float64, didWin bool) (playerDelta float64, playerNewRating float64, err error) {
	player, err := findUserByPlayerID(db, playerID)
	if err != nil {
		return 0, 0, err
	}

	if opponentRating <= 0 {
		opponentRating = 1500
	}

	oldPlayerRating := player.Rating
	newPlayerRating, _ := utils.CalculateElo(player.Rating, opponentRating, didWin)

	player.Rating = newPlayerRating
	if err := UpdateUserStats(db, player, didWin); err != nil {
		return 0, 0, err
	}

	return player.Rating - oldPlayerRating, player.Rating, nil
}

func CreateDrawMatch(db *gorm.DB, playerAID, playerBID, targetCode, pollutedCode string) (matchID string, err error) {
	playerA, err := findUserByPlayerID(db, playerAID)
	if err != nil {
		return "", err
	}
	playerB, err := findUserByPlayerID(db, playerBID)
	if err != nil {
		return "", err
	}

	match := &models.Match{
		MatchID:      uuid.New(),
		PlayerAID:    &playerA.ID,
		PlayerBID:    &playerB.ID,
		PlayerA:      playerA,
		PlayerB:      playerB,
		TargetCode:   targetCode,
		PollutedCode: pollutedCode,
		WinnerID:     0,
		Outcome:      "draw",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		FinishedAt:   time.Now(),
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(match).Error; err != nil {
			return err
		}
		if err := UpdateUserStatsForDraw(tx, playerA); err != nil {
			return err
		}
		if err := UpdateUserStatsForDraw(tx, playerB); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	return match.MatchID.String(), nil
}

func findUserByPlayerID(db *gorm.DB, playerID string) (*models.User, error) {
	var user models.User
	result := db.Where("CONCAT(provider, ':', provider_id) = ?", playerID).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func SaveMatchKeystrokes(db *gorm.DB, matchID string, playerID string, sent json.RawMessage, received json.RawMessage) error {
	keystroke := &models.MatchKeystroke{
		MatchID:   matchID,
		PlayerID:  playerID,
		Sent:      sent,
		Received:  received,
		CreatedAt: time.Now(),
	}
	return db.Create(keystroke).Error
}

func GetMatchKeystrokesByMatchID(db *gorm.DB, matchID string) ([]models.MatchKeystroke, error) {
	var keystrokes []models.MatchKeystroke
	result := db.Where("match_id = ?", matchID).Find(&keystrokes)
	return keystrokes, result.Error
}

func GetMatchByMatchID(db *gorm.DB, matchID string) (*models.Match, error) {
	var match models.Match
	result := db.Preload("PlayerA").Preload("PlayerB").Where("match_id = ?", matchID).First(&match)
	if result.Error != nil {
		return nil, result.Error
	}
	return &match, nil
}

func GetRecentMatchesForUser(db *gorm.DB, userID uint, limit int) ([]models.Match, error) {
	if limit <= 0 {
		limit = 20
	}

	var matches []models.Match
	result := db.
		Preload("PlayerA").
		Preload("PlayerB").
		Where("player_a_id = ? OR player_b_id = ?", userID, userID).
		Order("finished_at DESC").
		Order("updated_at DESC").
		Limit(limit).
		Find(&matches)

	return matches, result.Error
}

func GetRecentMatchesForUserPaged(db *gorm.DB, userID uint, limit int, offset int) ([]models.Match, error) {
	if limit <= 0 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	var matches []models.Match
	result := db.
		Preload("PlayerA").
		Preload("PlayerB").
		Where("player_a_id = ? OR player_b_id = ?", userID, userID).
		Order("finished_at DESC").
		Order("updated_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&matches)

	return matches, result.Error
}

func CountMatchesForUser(db *gorm.DB, userID uint) (int64, error) {
	var count int64
	result := db.Model(&models.Match{}).
		Where("player_a_id = ? OR player_b_id = ?", userID, userID).
		Count(&count)

	return count, result.Error
}

func CreateMixedMatchForReplay(db *gorm.DB, authUserID uint, authIsPlayerA bool, guestID string, guestName string, guestAvatarURL string, authWon bool, targetCode string, pollutedCode string) (string, error) {
	match := &models.Match{
		MatchID:      uuid.New(),
		TargetCode:   targetCode,
		PollutedCode: pollutedCode,
		Outcome:      "decisive",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		FinishedAt:   time.Now(),
	}

	guestID = strings.TrimSpace(guestID)
	guestName = strings.TrimSpace(guestName)
	guestAvatarURL = strings.TrimSpace(guestAvatarURL)

	if authIsPlayerA {
		match.PlayerAID = &authUserID
		if guestID != "" {
			match.PlayerBGuestID = &guestID
		}
		if guestName != "" {
			match.PlayerBGuestName = &guestName
		}
		if guestAvatarURL != "" {
			match.PlayerBGuestAvatarURL = &guestAvatarURL
		}
	} else {
		match.PlayerBID = &authUserID
		if guestID != "" {
			match.PlayerAGuestID = &guestID
		}
		if guestName != "" {
			match.PlayerAGuestName = &guestName
		}
		if guestAvatarURL != "" {
			match.PlayerAGuestAvatarURL = &guestAvatarURL
		}
	}

	if authWon {
		match.WinnerID = authUserID
	} else {
		match.WinnerID = 0
	}

	if err := db.Create(match).Error; err != nil {
		return "", err
	}
	return match.MatchID.String(), nil
}

func GetReplayAvailabilityByMatchIDs(db *gorm.DB, matchIDs []string) (map[string]bool, error) {
	availability := make(map[string]bool, len(matchIDs))
	if len(matchIDs) == 0 {
		return availability, nil
	}

	type replayCount struct {
		MatchID string
		Count   int64
	}

	var rows []replayCount
	if err := db.
		Model(&models.MatchKeystroke{}).
		Select("match_id, COUNT(*) as count").
		Where("match_id IN ?", matchIDs).
		Group("match_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	for _, row := range rows {
		availability[row.MatchID] = row.Count > 0
	}

	return availability, nil
}

func GetRecentKeystrokesForPlayers(db *gorm.DB, playerIDs []string, limit int) ([]models.MatchKeystroke, error) {
	if limit <= 0 {
		limit = 20
	}
	if len(playerIDs) == 0 {
		return []models.MatchKeystroke{}, nil
	}

	var keystrokes []models.MatchKeystroke
	result := db.
		Where("player_id IN ?", playerIDs).
		Order("created_at DESC").
		Limit(limit).
		Find(&keystrokes)

	return keystrokes, result.Error
}
