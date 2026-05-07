package db

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Match struct {
	MatchID    uuid.UUID
	PlayerA    uuid.UUID
	PlayerB    uuid.UUID
	CreatedAt  time.Time
	UpdatedAt  time.Time
	FinishedAt time.Time
	Winner     uuid.UUID
}

func CreateMatchUpdatePlayer(db *gorm.DB, playerA, playerB uuid.UUID) (*Match, error) {
	match := &Match{
		MatchID:    uuid.New(),
		PlayerA:    playerA,
		PlayerB:    playerB,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		FinishedAt: time.Now(),
		Winner:     uuid.New(),
	}
	if err := db.Create(match).Error; err != nil {
		return nil, err
	}
	return match, nil
}
