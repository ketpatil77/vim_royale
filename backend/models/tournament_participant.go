package models

import (
	"time"

	"gorm.io/gorm"
)

type TournamentParticipant struct {
	gorm.Model
	TournamentID          uint       `json:"tournamentId" gorm:"index;uniqueIndex:idx_tournament_user,where:user_id IS NOT NULL;uniqueIndex:idx_tournament_guest,where:guest_id IS NOT NULL"`
	Tournament            Tournament `json:"-"`
	UserID                *uint      `json:"userId,omitempty" gorm:"index;uniqueIndex:idx_tournament_user,where:user_id IS NOT NULL"`
	User                  *User      `json:"-"`
	GuestID               *string    `json:"guestId,omitempty" gorm:"size:64;index;uniqueIndex:idx_tournament_guest,where:guest_id IS NOT NULL"`
	GuestSessionTokenHash string     `json:"-" gorm:"type:char(64);index"`
	DisplayName           string     `json:"displayName"`
	AvatarURL             string     `json:"avatarUrl"`
	Seed                  *int       `json:"seed,omitempty" gorm:"index"`
	JoinedAt              time.Time  `json:"joinedAt"`
	EliminatedAt          *time.Time `json:"eliminatedAt,omitempty"`
	IsHost                bool       `json:"isHost" gorm:"default:false"`
}

func (TournamentParticipant) TableName() string {
	return "tournament_participants"
}
