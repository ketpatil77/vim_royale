package database

import (
	"time"
	"vim_royale/backend/models"
	"vim_royale/backend/utils"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func CreateMatchAndSendRatingDelta(db *gorm.DB, winnerID, loserID string) (winnerDelta, loserDelta, winnerNewRating, loserNewRating float64, err error) {
	winner, err := findUserByPlayerID(db, winnerID)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	loser, err := findUserByPlayerID(db, loserID)
	if err != nil {
		return 0, 0, 0, 0, err
	}

	oldWinnerRating := winner.Rating
	oldLoserRating := loser.Rating

	match := &models.Match{
		MatchID:    uuid.New(),
		PlayerAID:  winner.ID,
		PlayerBID:  loser.ID,
		PlayerA:    *winner,
		PlayerB:    *loser,
		WinnerID:   winner.ID,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		FinishedAt: time.Now(),
	}
	if err := db.Create(match).Error; err != nil {
		return 0, 0, 0, 0, err
	}

	newWinnerRating, newLoserRating := utils.CalculateElo(winner.Rating, loser.Rating, true)

	winner.Rating = newWinnerRating
	loser.Rating = newLoserRating

	if err := UpdateUserStats(db, winner, true); err != nil {
		return 0, 0, 0, 0, err
	}
	if err := UpdateUserStats(db, loser, false); err != nil {
		return 0, 0, 0, 0, err
	}

	return winner.Rating - oldWinnerRating, loser.Rating - oldLoserRating, winner.Rating, loser.Rating, nil
}

func findUserByPlayerID(db *gorm.DB, playerID string) (*models.User, error) {
	var user models.User
	result := db.Where("CONCAT(provider, ':', provider_id) = ?", playerID).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}
