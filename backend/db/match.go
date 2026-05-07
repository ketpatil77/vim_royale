package database

import (
	"time"

	"vim_royale/backend/models"
	"vim_royale/backend/utils"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func CreateMatch(db *gorm.DB, winnerID, loserID string) error {
	winner, err := findUserByPlayerID(db, winnerID)
	if err != nil {
		return err
	}
	loser, err := findUserByPlayerID(db, loserID)
	if err != nil {
		return err
	}

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
		return err
	}

	winnerRating, loserRating := utils.CalculateElo(winner.Rating, loser.Rating, true)

	winner.Rating = winnerRating
	loser.Rating = loserRating

	if err := UpdateUser(db, winner, true); err != nil {
		return err
	}
	if err := UpdateUser(db, loser, false); err != nil {
		return err
	}

	return nil
}

func findUserByPlayerID(db *gorm.DB, playerID string) (*models.User, error) {
	var user models.User
	result := db.Where("CONCAT(provider, ':', provider_id) = ?", playerID).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}
