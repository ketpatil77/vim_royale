package models

import (
	"time"

	"gorm.io/gorm"
)

type TournamentStatus string

const (
	TournamentStatusLobby    TournamentStatus = "lobby"
	TournamentStatusActive   TournamentStatus = "active"
	TournamentStatusFinished TournamentStatus = "finished"
)

type TournamentFormat string

const (
	TournamentFormatSingleElimination TournamentFormat = "single_elimination"
)

type Tournament struct {
	gorm.Model
	Name            string           `json:"name"`
	Slug            string           `json:"slug" gorm:"uniqueIndex;size:24"`
	HostUserID      uint             `json:"hostUserId" gorm:"index"`
	HostUser        User             `json:"hostUser"`
	Status          TournamentStatus `json:"status" gorm:"type:varchar(24);default:'lobby';index"`
	Format          TournamentFormat `json:"format" gorm:"type:varchar(32);default:'single_elimination'"`
	MaxPlayers      int              `json:"maxPlayers" gorm:"default:16"`
	IsLocked        bool             `json:"isLocked" gorm:"default:false"`
	InviteTokenHash string           `json:"-" gorm:"type:char(64);index"`
	StartedAt       *time.Time       `json:"startedAt,omitempty"`
	EndedAt         *time.Time       `json:"endedAt,omitempty"`
}

func (Tournament) TableName() string {
	return "tournaments"
}
