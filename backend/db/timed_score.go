package database

import (
	"time"
	"vim_royale/backend/models"

	"gorm.io/gorm"
)

type TimedBestScore struct {
	Difficulty  string
	TimeSeconds int
	CompletedAt time.Time
}

func SaveTimedScore(db *gorm.DB, userID uint, difficulty string, timeSeconds int) (*models.TimedScore, error) {
	score := &models.TimedScore{
		UserID:      userID,
		Difficulty:  difficulty,
		TimeSeconds: timeSeconds,
		CompletedAt: time.Now().UTC(),
	}

	if err := db.Create(score).Error; err != nil {
		return nil, err
	}
	return score, nil
}

func GetBestTimedScoresByDifficulty(db *gorm.DB, userID uint) ([]TimedBestScore, error) {
	var scores []models.TimedScore
	if err := db.
		Where("user_id = ?", userID).
		Order("difficulty ASC, time_seconds ASC, completed_at ASC").
		Find(&scores).Error; err != nil {
		return nil, err
	}

	bestByDifficulty := map[string]TimedBestScore{}
	for _, s := range scores {
		best, ok := bestByDifficulty[s.Difficulty]
		if !ok || s.TimeSeconds < best.TimeSeconds || (s.TimeSeconds == best.TimeSeconds && s.CompletedAt.Before(best.CompletedAt)) {
			bestByDifficulty[s.Difficulty] = TimedBestScore{
				Difficulty:  s.Difficulty,
				TimeSeconds: s.TimeSeconds,
				CompletedAt: s.CompletedAt,
			}
		}
	}

	result := make([]TimedBestScore, 0, len(bestByDifficulty))
	for _, v := range bestByDifficulty {
		result = append(result, v)
	}
	return result, nil
}
