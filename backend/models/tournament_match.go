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

type TournamentStageType string

const (
	TournamentStageTypeKnockout   TournamentStageType = "knockout"
	TournamentStageTypeGroup      TournamentStageType = "group"
	TournamentStageTypeGrandFinal TournamentStageType = "grand_final"
)

type TournamentBracketType string

const (
	TournamentBracketTypeMain    TournamentBracketType = "main"
	TournamentBracketTypeWinners TournamentBracketType = "winners"
	TournamentBracketTypeLosers  TournamentBracketType = "losers"
)

type TournamentMatch struct {
	gorm.Model
	TournamentID         uint                   `json:"tournamentId" gorm:"index;uniqueIndex:idx_tournament_round_slot"`
	Tournament           Tournament             `json:"-"`
	Round                int                    `json:"round" gorm:"index;uniqueIndex:idx_tournament_round_slot"`
	Slot                 int                    `json:"slot" gorm:"index;uniqueIndex:idx_tournament_round_slot"`
	StageType            TournamentStageType    `json:"stageType,omitempty" gorm:"type:varchar(24);default:'knockout';index"`
	BracketType          TournamentBracketType  `json:"bracketType,omitempty" gorm:"type:varchar(24);default:'main';index"`
	GroupNumber          *int                   `json:"groupNumber,omitempty" gorm:"index"`
	StageRound           *int                   `json:"stageRound,omitempty" gorm:"index"`
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
