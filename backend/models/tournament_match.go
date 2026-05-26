package models

import (
	"time"

	"gorm.io/gorm"
)

type TournamentMatchStatus string

const (
	TournamentMatchPending   TournamentMatchStatus = "pending"
	TournamentMatchPlaying   TournamentMatchStatus = "playing"
	TournamentMatchCompleted TournamentMatchStatus = "completed"
)

type TournamentMatch struct {
	gorm.Model
	TournamentID         uint                   `json:"tournamentId" gorm:"index;uniqueIndex:idx_tournament_round_slot"`
	Tournament           Tournament             `json:"-"`
	Round                int                    `json:"round" gorm:"index;uniqueIndex:idx_tournament_round_slot"`
	Slot                 int                    `json:"slot" gorm:"index;uniqueIndex:idx_tournament_round_slot"`
	PlayerAParticipantID *uint                  `json:"playerAParticipantId,omitempty" gorm:"index"`
	PlayerA              *TournamentParticipant `json:"-" gorm:"foreignKey:PlayerAParticipantID;references:ID"`
	PlayerBParticipantID *uint                  `json:"playerBParticipantId,omitempty" gorm:"index"`
	PlayerB              *TournamentParticipant `json:"-" gorm:"foreignKey:PlayerBParticipantID;references:ID"`
	WinnerParticipantID  *uint                  `json:"winnerParticipantId,omitempty" gorm:"index"`
	Winner               *TournamentParticipant `json:"-" gorm:"foreignKey:WinnerParticipantID;references:ID"`
	Status               TournamentMatchStatus  `json:"status" gorm:"type:varchar(24);default:'pending';index"`
	LiveMatchID          *string                `json:"liveMatchId,omitempty" gorm:"index"`
	StartedAt            *time.Time             `json:"startedAt,omitempty"`
	FinishedAt           *time.Time             `json:"finishedAt,omitempty"`
}

func (TournamentMatch) TableName() string {
	return "tournament_matches"
}
