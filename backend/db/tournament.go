package database

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"vim_royale/backend/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CreateTournamentInput struct {
	HostUserID      uint
	Name            string
	MaxPlayers      int
	Format          models.TournamentFormat
	GrandFinalReset *bool
	GroupSize       *int
	AdvancePerGroup *int
}

type JoinTournamentInput struct {
	TournamentID uint
	InviteToken  string
	UserID       *uint
	SessionToken string
	DisplayName  string
	AvatarURL    string
}

type JoinTournamentResult struct {
	Tournament        *models.Tournament
	Participant       *models.TournamentParticipant
	GuestSessionToken string
}

type TournamentLeaderboardEntry struct {
	ParticipantID uint      `json:"participantId"`
	DisplayName   string    `json:"displayName"`
	AvatarURL     string    `json:"avatarUrl"`
	Seed          *int      `json:"seed,omitempty"`
	JoinedAt      time.Time `json:"joinedAt"`
	Wins          int       `json:"wins"`
	Losses        int       `json:"losses"`
	Points        int       `json:"points"`
}

type TournamentQueueEligibility struct {
	Eligible         bool
	ReasonCode       string
	Participant      *models.TournamentParticipant
	OpponentPlayerID string
}

func CreateTournament(db *gorm.DB, input CreateTournamentInput) (*models.Tournament, string, error) {
	if input.HostUserID == 0 {
		return nil, "", fmt.Errorf("host user is required")
	}
	if strings.TrimSpace(input.Name) == "" {
		return nil, "", fmt.Errorf("tournament name is required")
	}
	if input.MaxPlayers <= 1 {
		input.MaxPlayers = 8
	}
	if input.Format == "" {
		input.Format = models.TournamentFormatSingleElimination
	}
	if err := validateCreateTournamentInput(&input); err != nil {
		return nil, "", err
	}

	var host models.User
	if err := db.First(&host, input.HostUserID).Error; err != nil {
		return nil, "", err
	}

	slug, err := generateUniqueTournamentSlug(db)
	if err != nil {
		return nil, "", err
	}
	inviteToken, err := generateSecureToken(24)
	if err != nil {
		return nil, "", err
	}

	tournament := &models.Tournament{
		Name:            strings.TrimSpace(input.Name),
		Slug:            slug,
		HostUserID:      input.HostUserID,
		Status:          models.TournamentStatusLobby,
		Format:          input.Format,
		GrandFinalReset: input.GrandFinalReset,
		GroupSize:       input.GroupSize,
		AdvancePerGroup: input.AdvancePerGroup,
		MaxPlayers:      input.MaxPlayers,
		IsLocked:        false,
		InviteTokenHash: hashToken(inviteToken),
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(tournament).Error; err != nil {
			return err
		}

		displayName := host.DisplayName
		if strings.TrimSpace(displayName) == "" {
			displayName = host.Username
		}

		hostParticipant := &models.TournamentParticipant{
			TournamentID: tournament.ID,
			UserID:       &host.ID,
			DisplayName:  displayName,
			AvatarURL:    host.AvatarURL,
			JoinedAt:     time.Now().UTC(),
			IsHost:       true,
		}
		return tx.Create(hostParticipant).Error
	})
	if err != nil {
		return nil, "", err
	}

	return tournament, inviteToken, nil
}

func validateCreateTournamentInput(input *CreateTournamentInput) error {
	if input == nil {
		return fmt.Errorf("invalid tournament input")
	}

	switch input.Format {
	case models.TournamentFormatSingleElimination:
		input.GrandFinalReset = nil
		input.GroupSize = nil
		input.AdvancePerGroup = nil
		return nil
	case models.TournamentFormatDoubleElimination:
		if input.GrandFinalReset == nil {
			defaultReset := true
			input.GrandFinalReset = &defaultReset
		}
		input.GroupSize = nil
		input.AdvancePerGroup = nil
		return nil
	case models.TournamentFormatGroupKnockout:
		if input.GroupSize == nil || *input.GroupSize < 2 {
			return fmt.Errorf("groupSize must be at least 2 for group_knockout")
		}
		if input.AdvancePerGroup == nil || *input.AdvancePerGroup < 1 {
			return fmt.Errorf("advancePerGroup must be at least 1 for group_knockout")
		}
		if *input.AdvancePerGroup >= *input.GroupSize {
			return fmt.Errorf("advancePerGroup must be less than groupSize for group_knockout")
		}
		input.GrandFinalReset = nil
		return nil
	default:
		return fmt.Errorf("unsupported tournament format: %s", input.Format)
	}
}

func GetTournamentByID(db *gorm.DB, tournamentID uint) (*models.Tournament, error) {
	var tournament models.Tournament
	if err := db.Preload("HostUser").First(&tournament, tournamentID).Error; err != nil {
		return nil, err
	}
	return &tournament, nil
}

func GetTournamentBySlug(db *gorm.DB, slug string) (*models.Tournament, error) {
	var tournament models.Tournament
	if err := db.Preload("HostUser").Where("slug = ?", slug).First(&tournament).Error; err != nil {
		return nil, err
	}
	return &tournament, nil
}

func IsTournamentHost(db *gorm.DB, tournamentID, userID uint) (bool, error) {
	var count int64
	if err := db.Model(&models.Tournament{}).
		Where("id = ? AND host_user_id = ?", tournamentID, userID).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func JoinTournament(db *gorm.DB, input JoinTournamentInput) (*JoinTournamentResult, error) {
	tournament, err := GetTournamentByID(db, input.TournamentID)
	if err != nil {
		return nil, err
	}

	if tournament.IsLocked {
		return nil, fmt.Errorf("tournament is locked")
	}

	if hashToken(input.InviteToken) != tournament.InviteTokenHash {
		return nil, fmt.Errorf("invalid invite token")
	}

	result := &JoinTournamentResult{
		Tournament: tournament,
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		if input.UserID != nil {
			var existing models.TournamentParticipant
			err := tx.Where("tournament_id = ? AND user_id = ?", tournament.ID, *input.UserID).First(&existing).Error
			if err == nil {
				result.Participant = &existing
				return nil
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}

			var user models.User
			if err := tx.First(&user, *input.UserID).Error; err != nil {
				return err
			}
			if full, err := isTournamentFull(tx, tournament.ID, tournament.MaxPlayers); err != nil {
				return err
			} else if full {
				return fmt.Errorf("tournament is full")
			}

			displayName := strings.TrimSpace(input.DisplayName)
			if displayName == "" {
				displayName = strings.TrimSpace(user.DisplayName)
			}
			if displayName == "" {
				displayName = user.Username
			}
			avatarURL := strings.TrimSpace(input.AvatarURL)
			if avatarURL == "" {
				avatarURL = user.AvatarURL
			}

			participant := &models.TournamentParticipant{
				TournamentID: tournament.ID,
				UserID:       &user.ID,
				DisplayName:  displayName,
				AvatarURL:    avatarURL,
				JoinedAt:     time.Now().UTC(),
				IsHost:       false,
			}
			if err := tx.Create(participant).Error; err != nil {
				return err
			}
			result.Participant = participant
			return nil
		}

		sessionToken, tokenErr := generateSecureToken(24)
		if tokenErr != nil {
			return tokenErr
		}

		if strings.TrimSpace(input.SessionToken) != "" {
			var existing models.TournamentParticipant
			err := tx.
				Where("tournament_id = ? AND guest_session_token_hash = ?", tournament.ID, hashToken(strings.TrimSpace(input.SessionToken))).
				First(&existing).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			if err == nil {
				if existing.UserID != nil {
					return fmt.Errorf("session token is not for a guest participant")
				}
				existing.GuestSessionTokenHash = hashToken(sessionToken)
				if strings.TrimSpace(input.DisplayName) != "" {
					existing.DisplayName = strings.TrimSpace(input.DisplayName)
				}
				if strings.TrimSpace(input.AvatarURL) != "" {
					existing.AvatarURL = strings.TrimSpace(input.AvatarURL)
				}
				if updateErr := tx.Save(&existing).Error; updateErr != nil {
					return updateErr
				}
				result.Participant = &existing
				result.GuestSessionToken = sessionToken
				return nil
			}
		}
		if full, err := isTournamentFull(tx, tournament.ID, tournament.MaxPlayers); err != nil {
			return err
		} else if full {
			return fmt.Errorf("tournament is full")
		}

		displayName := strings.TrimSpace(input.DisplayName)
		if displayName == "" {
			displayName = "Guest"
		}

		guestID := uuid.NewString()
		participant := &models.TournamentParticipant{
			TournamentID:          tournament.ID,
			GuestID:               &guestID,
			GuestSessionTokenHash: hashToken(sessionToken),
			DisplayName:           displayName,
			AvatarURL:             strings.TrimSpace(input.AvatarURL),
			JoinedAt:              time.Now().UTC(),
			IsHost:                false,
		}
		if err := tx.Create(participant).Error; err != nil {
			return err
		}

		result.Participant = participant
		result.GuestSessionToken = sessionToken
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func FindTournamentParticipantForAccess(db *gorm.DB, tournamentID uint, userID *uint, guestSessionToken string) (*models.TournamentParticipant, error) {
	var participant models.TournamentParticipant

	if userID != nil {
		if err := db.Where("tournament_id = ? AND user_id = ?", tournamentID, *userID).First(&participant).Error; err == nil {
			return &participant, nil
		}
	}

	if strings.TrimSpace(guestSessionToken) != "" {
		tokenHash := hashToken(strings.TrimSpace(guestSessionToken))
		if err := db.Where("tournament_id = ? AND guest_session_token_hash = ?", tournamentID, tokenHash).First(&participant).Error; err == nil {
			return &participant, nil
		}
	}

	return nil, gorm.ErrRecordNotFound
}

func GetTournamentParticipantByPlayerIdentity(db *gorm.DB, tournamentID uint, playerID string) (*models.TournamentParticipant, error) {
	trimmed := strings.TrimSpace(playerID)
	if trimmed == "" {
		return nil, gorm.ErrRecordNotFound
	}

	if provider, providerID := splitProviderID(trimmed); provider != "" && providerID != "" {
		user, err := GetUserFromProvider(db, provider, providerID)
		if err != nil {
			return nil, err
		}
		var participant models.TournamentParticipant
		if err := db.Where("tournament_id = ? AND user_id = ?", tournamentID, user.ID).First(&participant).Error; err != nil {
			return nil, err
		}
		return &participant, nil
	}

	if _, err := uuid.Parse(trimmed); err != nil {
		return nil, gorm.ErrRecordNotFound
	}

	var participant models.TournamentParticipant
	if err := db.Where("tournament_id = ? AND guest_id = ?", tournamentID, trimmed).First(&participant).Error; err != nil {
		return nil, err
	}
	return &participant, nil
}

func GetTournamentQueueEligibility(db *gorm.DB, tournamentID uint, playerID string) (*TournamentQueueEligibility, error) {
	tournament, err := GetTournamentByID(db, tournamentID)
	if err != nil {
		return nil, err
	}
	if tournament.Status != models.TournamentStatusActive {
		return &TournamentQueueEligibility{
			Eligible:   false,
			ReasonCode: "tournament_not_active",
		}, nil
	}

	participant, err := GetTournamentParticipantByPlayerIdentity(db, tournamentID, playerID)
	if err != nil {
		return &TournamentQueueEligibility{
			Eligible:   false,
			ReasonCode: "tournament_access_denied",
		}, nil
	}

	var match models.TournamentMatch
	err = db.
		Where(
			"tournament_id = ? AND status IN ? AND (player_a_participant_id = ? OR player_b_participant_id = ?)",
			tournamentID,
			[]models.TournamentMatchStatus{models.TournamentMatchPending, models.TournamentMatchPlaying},
			participant.ID,
			participant.ID,
		).
		Order("round ASC, slot ASC").
		First(&match).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &TournamentQueueEligibility{
			Eligible:    false,
			ReasonCode:  "eliminated",
			Participant: participant,
		}, nil
	}
	if err != nil {
		return nil, err
	}

	if match.Status == models.TournamentMatchPlaying {
		return &TournamentQueueEligibility{
			Eligible:    false,
			ReasonCode:  "already_in_bracket_match",
			Participant: participant,
		}, nil
	}

	var opponentParticipantID *uint
	if match.PlayerAParticipantID != nil && *match.PlayerAParticipantID == participant.ID {
		opponentParticipantID = match.PlayerBParticipantID
	} else {
		opponentParticipantID = match.PlayerAParticipantID
	}
	if opponentParticipantID == nil {
		return &TournamentQueueEligibility{
			Eligible:    false,
			ReasonCode:  "waiting_for_opponent",
			Participant: participant,
		}, nil
	}

	opponentPlayerID, err := GetTournamentParticipantPlayerID(db, *opponentParticipantID)
	if err != nil || strings.TrimSpace(opponentPlayerID) == "" {
		return &TournamentQueueEligibility{
			Eligible:    false,
			ReasonCode:  "waiting_for_opponent",
			Participant: participant,
		}, nil
	}

	return &TournamentQueueEligibility{
		Eligible:         true,
		ReasonCode:       "",
		Participant:      participant,
		OpponentPlayerID: opponentPlayerID,
	}, nil
}

func GetTournamentParticipantPlayerID(db *gorm.DB, participantID uint) (string, error) {
	var participant models.TournamentParticipant
	if err := db.First(&participant, participantID).Error; err != nil {
		return "", err
	}

	if participant.UserID != nil {
		var user models.User
		if err := db.First(&user, *participant.UserID).Error; err != nil {
			return "", err
		}
		return user.Provider + ":" + user.ProviderID, nil
	}

	if participant.GuestID != nil && strings.TrimSpace(*participant.GuestID) != "" {
		return *participant.GuestID, nil
	}

	return "", gorm.ErrRecordNotFound
}

func GetTournamentParticipants(db *gorm.DB, tournamentID uint) ([]models.TournamentParticipant, error) {
	var participants []models.TournamentParticipant
	err := db.
		Where("tournament_id = ?", tournamentID).
		Order("seed IS NULL, seed ASC, joined_at ASC").
		Find(&participants).Error
	return participants, err
}

func GetTournamentMatches(db *gorm.DB, tournamentID uint) ([]models.TournamentMatch, error) {
	var matches []models.TournamentMatch
	err := db.
		Where("tournament_id = ?", tournamentID).
		Order("round ASC, slot ASC").
		Find(&matches).Error
	return matches, err
}

func LockTournament(db *gorm.DB, tournamentID uint, locked bool) error {
	return db.Model(&models.Tournament{}).
		Where("id = ?", tournamentID).
		Update("is_locked", locked).Error
}

func SeedTournament(db *gorm.DB, tournamentID uint, participantIDs []uint) error {
	if len(participantIDs) == 0 {
		return fmt.Errorf("participant ids are required")
	}

	participants, err := GetTournamentParticipants(db, tournamentID)
	if err != nil {
		return err
	}
	if len(participants) != len(participantIDs) {
		return fmt.Errorf("seed list size must match participant count")
	}

	byID := make(map[uint]struct{}, len(participants))
	for _, p := range participants {
		byID[p.ID] = struct{}{}
	}

	seen := make(map[uint]struct{}, len(participantIDs))
	for _, id := range participantIDs {
		if _, ok := byID[id]; !ok {
			return fmt.Errorf("participant %d does not belong to tournament", id)
		}
		if _, ok := seen[id]; ok {
			return fmt.Errorf("duplicate participant id %d in seeds", id)
		}
		seen[id] = struct{}{}
	}

	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.TournamentParticipant{}).
			Where("tournament_id = ?", tournamentID).
			Update("seed", nil).Error; err != nil {
			return err
		}

		for idx, participantID := range participantIDs {
			seed := idx + 1
			if err := tx.Model(&models.TournamentParticipant{}).
				Where("id = ? AND tournament_id = ?", participantID, tournamentID).
				Update("seed", seed).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func StartTournament(db *gorm.DB, tournamentID uint) error {
	tournament, err := GetTournamentByID(db, tournamentID)
	if err != nil {
		return err
	}

	participants, err := GetTournamentParticipants(db, tournamentID)
	if err != nil {
		return err
	}
	if len(participants) < 2 {
		return fmt.Errorf("at least two participants are required")
	}

	sort.SliceStable(participants, func(i, j int) bool {
		left := participants[i].Seed
		right := participants[j].Seed
		if left == nil && right == nil {
			return participants[i].JoinedAt.Before(participants[j].JoinedAt)
		}
		if left == nil {
			return false
		}
		if right == nil {
			return true
		}
		return *left < *right
	})

	return db.Transaction(func(tx *gorm.DB) error {
		// Clear elimination markers so the same room can be reused for a fresh run.
		if err := tx.Model(&models.TournamentParticipant{}).
			Where("tournament_id = ?", tournamentID).
			Update("eliminated_at", nil).Error; err != nil {
			return err
		}

		if err := tx.Unscoped().Where("tournament_id = ?", tournamentID).Delete(&models.TournamentMatch{}).Error; err != nil {
			return err
		}

		switch tournament.Format {
		case models.TournamentFormatSingleElimination:
			if err := buildSingleEliminationBracket(tx, tournamentID, participants); err != nil {
				return err
			}
		case models.TournamentFormatDoubleElimination:
			if len(participants) < 4 {
				return fmt.Errorf("at least four participants are required for double_elimination")
			}
			if err := buildDoubleEliminationBracket(tx, tournament, participants); err != nil {
				return err
			}
		case models.TournamentFormatGroupKnockout:
			return fmt.Errorf("format %s is not yet supported for start", tournament.Format)
		default:
			return fmt.Errorf("unsupported tournament format: %s", tournament.Format)
		}

		if err := advanceTournamentBracket(tx, tournamentID); err != nil {
			return err
		}

		now := time.Now().UTC()
		return tx.Model(&models.Tournament{}).
			Where("id = ?", tournamentID).
			Updates(map[string]any{
				"status":     models.TournamentStatusActive,
				"started_at": now,
				"ended_at":   nil,
				"is_locked":  true,
			}).Error
	})
}

func buildSingleEliminationBracket(tx *gorm.DB, tournamentID uint, participants []models.TournamentParticipant) error {
	bracketSize := nextPowerOfTwo(len(participants))
	totalRounds := numberOfRounds(bracketSize)
	ids := make([]*uint, bracketSize)
	for i := 0; i < len(participants); i++ {
		participantID := participants[i].ID
		ids[i] = &participantID
	}

	now := time.Now().UTC()
	for slot := 0; slot < bracketSize/2; slot++ {
		a := ids[slot*2]
		b := ids[slot*2+1]

		match := models.TournamentMatch{
			TournamentID:         tournamentID,
			Round:                1,
			Slot:                 slot + 1,
			StageType:            models.TournamentStageTypeKnockout,
			BracketType:          models.TournamentBracketTypeMain,
			StageRound:           intPtr(1),
			PlayerAParticipantID: a,
			PlayerBParticipantID: b,
			Status:               models.TournamentMatchPending,
		}

		// Auto-advance for byes in the initial bracket.
		if (a != nil && b == nil) || (a == nil && b != nil) {
			if a != nil {
				match.WinnerParticipantID = a
			} else {
				match.WinnerParticipantID = b
			}
			match.Status = models.TournamentMatchCompleted
			match.FinishedAt = &now
		} else if a == nil && b == nil {
			match.Status = models.TournamentMatchCompleted
			match.FinishedAt = &now
		}

		if err := tx.Create(&match).Error; err != nil {
			return err
		}
	}

	for round := 2; round <= totalRounds; round++ {
		roundMatches := bracketSize >> round
		for slot := 1; slot <= roundMatches; slot++ {
			match := models.TournamentMatch{
				TournamentID: tournamentID,
				Round:        round,
				Slot:         slot,
				StageType:    models.TournamentStageTypeKnockout,
				BracketType:  models.TournamentBracketTypeMain,
				StageRound:   intPtr(round),
				Status:       models.TournamentMatchPending,
			}
			if err := tx.Create(&match).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func buildDoubleEliminationBracket(tx *gorm.DB, tournament *models.Tournament, participants []models.TournamentParticipant) error {
	if tournament == nil {
		return fmt.Errorf("tournament is required")
	}

	bracketSize := nextPowerOfTwo(len(participants))
	winnersRounds := numberOfRounds(bracketSize)
	ids := make([]*uint, bracketSize)
	for i := 0; i < len(participants); i++ {
		participantID := participants[i].ID
		ids[i] = &participantID
	}

	roundCounter := 1
	now := time.Now().UTC()

	for wr := 1; wr <= winnersRounds; wr++ {
		matchesInRound := bracketSize >> wr
		for slot := 1; slot <= matchesInRound; slot++ {
			match := models.TournamentMatch{
				TournamentID: tournament.ID,
				Round:        roundCounter,
				Slot:         slot,
				StageType:    models.TournamentStageTypeKnockout,
				BracketType:  models.TournamentBracketTypeWinners,
				StageRound:   intPtr(wr),
				Status:       models.TournamentMatchPending,
			}

			if wr == 1 {
				a := ids[(slot-1)*2]
				b := ids[(slot-1)*2+1]
				match.PlayerAParticipantID = a
				match.PlayerBParticipantID = b
				if (a != nil && b == nil) || (a == nil && b != nil) {
					if a != nil {
						match.WinnerParticipantID = a
					} else {
						match.WinnerParticipantID = b
					}
					match.Status = models.TournamentMatchCompleted
					match.FinishedAt = &now
				} else if a == nil && b == nil {
					match.Status = models.TournamentMatchCompleted
					match.FinishedAt = &now
				}
			}

			if err := tx.Create(&match).Error; err != nil {
				return err
			}
		}
		roundCounter++
	}

	losersRounds := (winnersRounds - 1) * 2
	for lr := 1; lr <= losersRounds; lr++ {
		matchesInRound := doubleEliminationLosersRoundMatchCount(bracketSize, lr)
		for slot := 1; slot <= matchesInRound; slot++ {
			match := models.TournamentMatch{
				TournamentID: tournament.ID,
				Round:        roundCounter,
				Slot:         slot,
				StageType:    models.TournamentStageTypeKnockout,
				BracketType:  models.TournamentBracketTypeLosers,
				StageRound:   intPtr(lr),
				Status:       models.TournamentMatchPending,
			}
			if err := tx.Create(&match).Error; err != nil {
				return err
			}
		}
		roundCounter++
	}

	grandFinal := models.TournamentMatch{
		TournamentID: tournament.ID,
		Round:        roundCounter,
		Slot:         1,
		StageType:    models.TournamentStageTypeGrandFinal,
		BracketType:  models.TournamentBracketTypeMain,
		StageRound:   intPtr(1),
		Status:       models.TournamentMatchPending,
	}
	if err := tx.Create(&grandFinal).Error; err != nil {
		return err
	}
	roundCounter++

	if tournament.GrandFinalReset != nil && *tournament.GrandFinalReset {
		reset := models.TournamentMatch{
			TournamentID: tournament.ID,
			Round:        roundCounter,
			Slot:         1,
			StageType:    models.TournamentStageTypeGrandFinal,
			BracketType:  models.TournamentBracketTypeMain,
			StageRound:   intPtr(2),
			Status:       models.TournamentMatchPending,
		}
		if err := tx.Create(&reset).Error; err != nil {
			return err
		}
	}

	return nil
}

func GetTournamentLeaderboard(db *gorm.DB, tournamentID uint) ([]TournamentLeaderboardEntry, error) {
	participants, err := GetTournamentParticipants(db, tournamentID)
	if err != nil {
		return nil, err
	}

	leaderboard := make([]TournamentLeaderboardEntry, 0, len(participants))
	byID := make(map[uint]*TournamentLeaderboardEntry, len(participants))

	for i := range participants {
		p := participants[i]
		entry := TournamentLeaderboardEntry{
			ParticipantID: p.ID,
			DisplayName:   p.DisplayName,
			AvatarURL:     p.AvatarURL,
			Seed:          p.Seed,
			JoinedAt:      p.JoinedAt,
		}
		leaderboard = append(leaderboard, entry)
		byID[p.ID] = &leaderboard[len(leaderboard)-1]
	}

	matches, err := GetTournamentMatches(db, tournamentID)
	if err != nil {
		return nil, err
	}

	for _, match := range matches {
		if match.Status != models.TournamentMatchCompleted || match.WinnerParticipantID == nil {
			continue
		}

		winner := byID[*match.WinnerParticipantID]
		if winner != nil {
			winner.Wins++
			winner.Points += 3
		}

		if match.PlayerAParticipantID != nil && *match.PlayerAParticipantID != *match.WinnerParticipantID {
			if loser := byID[*match.PlayerAParticipantID]; loser != nil {
				loser.Losses++
			}
		}
		if match.PlayerBParticipantID != nil && *match.PlayerBParticipantID != *match.WinnerParticipantID {
			if loser := byID[*match.PlayerBParticipantID]; loser != nil {
				loser.Losses++
			}
		}
	}

	sort.SliceStable(leaderboard, func(i, j int) bool {
		if leaderboard[i].Points != leaderboard[j].Points {
			return leaderboard[i].Points > leaderboard[j].Points
		}
		if leaderboard[i].Wins != leaderboard[j].Wins {
			return leaderboard[i].Wins > leaderboard[j].Wins
		}
		if leaderboard[i].Losses != leaderboard[j].Losses {
			return leaderboard[i].Losses < leaderboard[j].Losses
		}
		if leaderboard[i].Seed == nil && leaderboard[j].Seed == nil {
			return leaderboard[i].JoinedAt.Before(leaderboard[j].JoinedAt)
		}
		if leaderboard[i].Seed == nil {
			return false
		}
		if leaderboard[j].Seed == nil {
			return true
		}
		return *leaderboard[i].Seed < *leaderboard[j].Seed
	})

	return leaderboard, nil
}

func ReportTournamentMatchWinner(db *gorm.DB, tournamentID, matchID, winnerParticipantID uint) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var match models.TournamentMatch
		if err := tx.Where("id = ? AND tournament_id = ?", matchID, tournamentID).First(&match).Error; err != nil {
			return err
		}
		if match.PlayerAParticipantID == nil && match.PlayerBParticipantID == nil {
			return fmt.Errorf("match has no players assigned")
		}

		validWinner := (match.PlayerAParticipantID != nil && *match.PlayerAParticipantID == winnerParticipantID) ||
			(match.PlayerBParticipantID != nil && *match.PlayerBParticipantID == winnerParticipantID)
		if !validWinner {
			return fmt.Errorf("winner is not part of this match")
		}

		now := time.Now().UTC()
		if err := tx.Model(&models.TournamentMatch{}).
			Where("id = ? AND tournament_id = ?", matchID, tournamentID).
			Updates(map[string]any{
				"winner_participant_id": winnerParticipantID,
				"status":                models.TournamentMatchCompleted,
				"finished_at":           now,
				"live_match_id":         nil,
			}).Error; err != nil {
			return err
		}

		return advanceTournamentBracket(tx, tournamentID)
	})
}

func ReportTournamentLiveMatchResult(db *gorm.DB, tournamentID uint, liveMatchID, winnerPlayerID, loserPlayerID string) error {
	if strings.TrimSpace(liveMatchID) == "" {
		return fmt.Errorf("live match id is required")
	}

	winnerParticipant, err := GetTournamentParticipantByPlayerIdentity(db, tournamentID, winnerPlayerID)
	if err != nil {
		return err
	}
	loserParticipant, err := GetTournamentParticipantByPlayerIdentity(db, tournamentID, loserPlayerID)
	if err != nil {
		return err
	}

	return db.Transaction(func(tx *gorm.DB) error {
		var match models.TournamentMatch
		err := tx.Where("tournament_id = ? AND live_match_id = ?", tournamentID, liveMatchID).First(&match).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			err = tx.Where(
				"tournament_id = ? AND status IN ? AND ((player_a_participant_id = ? AND player_b_participant_id = ?) OR (player_a_participant_id = ? AND player_b_participant_id = ?))",
				tournamentID,
				[]models.TournamentMatchStatus{models.TournamentMatchPending, models.TournamentMatchPlaying},
				winnerParticipant.ID, loserParticipant.ID, loserParticipant.ID, winnerParticipant.ID,
			).
				Order("round ASC, slot ASC").
				First(&match).Error
		}
		if err != nil {
			return err
		}

		now := time.Now().UTC()
		if err := tx.Model(&models.TournamentMatch{}).
			Where("id = ?", match.ID).
			Updates(map[string]any{
				"live_match_id":         liveMatchID,
				"winner_participant_id": winnerParticipant.ID,
				"status":                models.TournamentMatchCompleted,
				"finished_at":           now,
			}).Error; err != nil {
			return err
		}

		return advanceTournamentBracket(tx, tournamentID)
	})
}

func RequeueTournamentLiveMatch(db *gorm.DB, tournamentID uint, liveMatchID string) error {
	if strings.TrimSpace(liveMatchID) == "" {
		return nil
	}
	return db.Model(&models.TournamentMatch{}).
		Where("tournament_id = ? AND live_match_id = ?", tournamentID, liveMatchID).
		Updates(map[string]any{
			"status":        models.TournamentMatchPending,
			"live_match_id": nil,
			"started_at":    nil,
		}).Error
}

func MarkTournamentMatchPlaying(db *gorm.DB, tournamentID uint, liveMatchID, playerAID, playerBID string) error {
	playerA, err := GetTournamentParticipantByPlayerIdentity(db, tournamentID, playerAID)
	if err != nil {
		return err
	}
	playerB, err := GetTournamentParticipantByPlayerIdentity(db, tournamentID, playerBID)
	if err != nil {
		return err
	}

	var match models.TournamentMatch
	if err := db.
		Where(
			"tournament_id = ? AND status = ? AND live_match_id IS NULL AND ((player_a_participant_id = ? AND player_b_participant_id = ?) OR (player_a_participant_id = ? AND player_b_participant_id = ?))",
			tournamentID,
			models.TournamentMatchPending,
			playerA.ID, playerB.ID, playerB.ID, playerA.ID,
		).
		Order("round ASC, slot ASC").
		First(&match).Error; err != nil {
		return err
	}

	now := time.Now().UTC()
	return db.Model(&models.TournamentMatch{}).
		Where("id = ?", match.ID).
		Updates(map[string]any{
			"status":        models.TournamentMatchPlaying,
			"live_match_id": liveMatchID,
			"started_at":    now,
		}).Error
}

func RegenerateTournamentInvite(db *gorm.DB, tournamentID uint) (string, error) {
	token, err := generateSecureToken(24)
	if err != nil {
		return "", err
	}

	if err := db.Model(&models.Tournament{}).
		Where("id = ?", tournamentID).
		Update("invite_token_hash", hashToken(token)).Error; err != nil {
		return "", err
	}

	return token, nil
}

func isTournamentFull(db *gorm.DB, tournamentID uint, maxPlayers int) (bool, error) {
	var participantCount int64
	if err := db.Model(&models.TournamentParticipant{}).
		Where("tournament_id = ?", tournamentID).
		Count(&participantCount).Error; err != nil {
		return false, err
	}
	return participantCount >= int64(maxPlayers), nil
}

func advanceTournamentBracket(tx *gorm.DB, tournamentID uint) error {
	var tournament models.Tournament
	if err := tx.First(&tournament, tournamentID).Error; err != nil {
		return err
	}

	switch tournament.Format {
	case models.TournamentFormatSingleElimination:
		return advanceSingleEliminationBracket(tx, &tournament)
	case models.TournamentFormatDoubleElimination:
		return advanceDoubleEliminationBracket(tx, &tournament)
	default:
		return fmt.Errorf("unsupported tournament format for advancement: %s", tournament.Format)
	}
}

func advanceSingleEliminationBracket(tx *gorm.DB, tournament *models.Tournament) error {
	if tournament == nil {
		return fmt.Errorf("tournament is required")
	}

	tournamentID := tournament.ID
	var matches []models.TournamentMatch
	if err := tx.Where("tournament_id = ?", tournamentID).
		Order("round ASC, slot ASC").
		Find(&matches).Error; err != nil {
		return err
	}
	if len(matches) == 0 {
		return nil
	}

	indexByRoundSlot := make(map[string]*models.TournamentMatch, len(matches))
	maxRound := 1
	for i := range matches {
		m := &matches[i]
		indexByRoundSlot[roundSlotKey(m.Round, m.Slot)] = m
		if m.Round > maxRound {
			maxRound = m.Round
		}
	}

	changed := true
	for changed {
		changed = false
		for round := 2; round <= maxRound; round++ {
			slotsInRound := 1 << (maxRound - round)
			for slot := 1; slot <= slotsInRound; slot++ {
				match := indexByRoundSlot[roundSlotKey(round, slot)]
				if match == nil {
					continue
				}

				left := indexByRoundSlot[roundSlotKey(round-1, slot*2-1)]
				right := indexByRoundSlot[roundSlotKey(round-1, slot*2)]
				if left == nil || right == nil {
					continue
				}

				if left.Status != models.TournamentMatchCompleted || right.Status != models.TournamentMatchCompleted {
					continue
				}

				if winnerIDChanged(&match.PlayerAParticipantID, left.WinnerParticipantID) {
					changed = true
				}
				if winnerIDChanged(&match.PlayerBParticipantID, right.WinnerParticipantID) {
					changed = true
				}

				if match.Status == models.TournamentMatchPending {
					leftWinner := match.PlayerAParticipantID
					rightWinner := match.PlayerBParticipantID
					now := time.Now().UTC()
					switch {
					case leftWinner != nil && rightWinner == nil:
						match.WinnerParticipantID = leftWinner
						match.Status = models.TournamentMatchCompleted
						match.FinishedAt = &now
						changed = true
					case leftWinner == nil && rightWinner != nil:
						match.WinnerParticipantID = rightWinner
						match.Status = models.TournamentMatchCompleted
						match.FinishedAt = &now
						changed = true
					case leftWinner == nil && rightWinner == nil:
						match.WinnerParticipantID = nil
						match.Status = models.TournamentMatchCompleted
						match.FinishedAt = &now
						changed = true
					}
				}
			}
		}
	}

	for i := range matches {
		match := matches[i]
		updates := map[string]any{
			"player_a_participant_id": match.PlayerAParticipantID,
			"player_b_participant_id": match.PlayerBParticipantID,
			"winner_participant_id":   match.WinnerParticipantID,
			"status":                  match.Status,
			"finished_at":             match.FinishedAt,
		}
		if match.Status == models.TournamentMatchCompleted {
			updates["live_match_id"] = nil
		}
		if err := tx.Model(&models.TournamentMatch{}).
			Where("id = ?", match.ID).
			Updates(updates).Error; err != nil {
			return err
		}
	}

	final := indexByRoundSlot[roundSlotKey(maxRound, 1)]
	if final != nil && final.Status == models.TournamentMatchCompleted {
		now := time.Now().UTC()
		if err := tx.Model(&models.Tournament{}).
			Where("id = ?", tournamentID).
			Updates(map[string]any{
				"status":   models.TournamentStatusFinished,
				"ended_at": now,
			}).Error; err != nil {
			return err
		}
	}

	if err := syncParticipantEliminationState(tx, tournamentID, matches, 1); err != nil {
		return err
	}

	return nil
}

func advanceDoubleEliminationBracket(tx *gorm.DB, tournament *models.Tournament) error {
	if tournament == nil {
		return fmt.Errorf("tournament is required")
	}

	var matches []models.TournamentMatch
	if err := tx.Where("tournament_id = ?", tournament.ID).
		Order("round ASC, slot ASC, id ASC").
		Find(&matches).Error; err != nil {
		return err
	}
	if len(matches) == 0 {
		return nil
	}

	winners := make(map[int]map[int]*models.TournamentMatch)
	losers := make(map[int]map[int]*models.TournamentMatch)
	grandFinal := make(map[int]*models.TournamentMatch)
	maxWinnersRound := 0
	maxLosersRound := 0

	for i := range matches {
		m := &matches[i]
		stageRound := 0
		if m.StageRound != nil {
			stageRound = *m.StageRound
		}
		if stageRound < 1 {
			stageRound = m.Round
		}

		switch m.BracketType {
		case models.TournamentBracketTypeWinners:
			if _, ok := winners[stageRound]; !ok {
				winners[stageRound] = make(map[int]*models.TournamentMatch)
			}
			winners[stageRound][m.Slot] = m
			if stageRound > maxWinnersRound {
				maxWinnersRound = stageRound
			}
		case models.TournamentBracketTypeLosers:
			if _, ok := losers[stageRound]; !ok {
				losers[stageRound] = make(map[int]*models.TournamentMatch)
			}
			losers[stageRound][m.Slot] = m
			if stageRound > maxLosersRound {
				maxLosersRound = stageRound
			}
		default:
			grandFinal[stageRound] = m
		}
	}

	changed := true
	for changed {
		changed = false

		for wr := 2; wr <= maxWinnersRound; wr++ {
			targetRound, ok := winners[wr]
			if !ok {
				continue
			}
			prevRound := winners[wr-1]
			for slot, match := range targetRound {
				left := prevRound[slot*2-1]
				right := prevRound[slot*2]
				if left == nil || right == nil {
					continue
				}
				if left.Status != models.TournamentMatchCompleted || right.Status != models.TournamentMatchCompleted {
					continue
				}
				if winnerIDChanged(&match.PlayerAParticipantID, left.WinnerParticipantID) {
					changed = true
				}
				if winnerIDChanged(&match.PlayerBParticipantID, right.WinnerParticipantID) {
					changed = true
				}
				if autoCompletePendingMatch(match) {
					changed = true
				}
			}
		}

		for phase := 1; phase <= maxWinnersRound-1; phase++ {
			lrA := phase*2 - 1
			lrB := phase * 2
			roundA := losers[lrA]
			roundB := losers[lrB]
			if roundA == nil || roundB == nil {
				continue
			}

			for slot, match := range roundA {
				if phase == 1 {
					sourceLeft := winners[1][slot*2-1]
					sourceRight := winners[1][slot*2]
					if sourceLeft == nil || sourceRight == nil {
						continue
					}
					if sourceLeft.Status != models.TournamentMatchCompleted || sourceRight.Status != models.TournamentMatchCompleted {
						continue
					}
					leftLoser := loserParticipantID(sourceLeft)
					rightLoser := loserParticipantID(sourceRight)
					if winnerIDChanged(&match.PlayerAParticipantID, leftLoser) {
						changed = true
					}
					if winnerIDChanged(&match.PlayerBParticipantID, rightLoser) {
						changed = true
					}
				} else {
					sourceLeft := losers[lrA-1][slot*2-1]
					sourceRight := losers[lrA-1][slot*2]
					if sourceLeft == nil || sourceRight == nil {
						continue
					}
					if sourceLeft.Status != models.TournamentMatchCompleted || sourceRight.Status != models.TournamentMatchCompleted {
						continue
					}
					leftWinner := matchWinnerParticipantID(sourceLeft)
					rightWinner := matchWinnerParticipantID(sourceRight)
					if winnerIDChanged(&match.PlayerAParticipantID, leftWinner) {
						changed = true
					}
					if winnerIDChanged(&match.PlayerBParticipantID, rightWinner) {
						changed = true
					}
				}
				if autoCompletePendingMatch(match) {
					changed = true
				}
			}

			for slot, match := range roundB {
				sourceA := roundA[slot]
				sourceB := winners[phase+1][slot]
				if sourceA == nil || sourceB == nil {
					continue
				}
				if sourceA.Status != models.TournamentMatchCompleted || sourceB.Status != models.TournamentMatchCompleted {
					continue
				}
				a := matchWinnerParticipantID(sourceA)
				b := loserParticipantID(sourceB)
				if winnerIDChanged(&match.PlayerAParticipantID, a) {
					changed = true
				}
				if winnerIDChanged(&match.PlayerBParticipantID, b) {
					changed = true
				}
				if autoCompletePendingMatch(match) {
					changed = true
				}
			}
		}

		if maxWinnersRound > 0 && maxLosersRound > 0 {
			gf1 := grandFinal[1]
			if gf1 != nil {
				wbFinal := winners[maxWinnersRound][1]
				lbFinal := losers[maxLosersRound][1]
				if wbFinal != nil && lbFinal != nil &&
					wbFinal.Status == models.TournamentMatchCompleted &&
					lbFinal.Status == models.TournamentMatchCompleted {
					wbChampion := matchWinnerParticipantID(wbFinal)
					lbChampion := matchWinnerParticipantID(lbFinal)

					if winnerIDChanged(&gf1.PlayerAParticipantID, wbChampion) {
						changed = true
					}
					if winnerIDChanged(&gf1.PlayerBParticipantID, lbChampion) {
						changed = true
					}
					if autoCompletePendingMatch(gf1) {
						changed = true
					}
				}

				gf2 := grandFinal[2]
				if gf2 != nil {
					wbChampion := matchWinnerParticipantID(winners[maxWinnersRound][1])
					lbChampion := matchWinnerParticipantID(losers[maxLosersRound][1])
					shouldEnableReset := gf1.Status == models.TournamentMatchCompleted &&
						gf1.WinnerParticipantID != nil &&
						wbChampion != nil &&
						*gf1.WinnerParticipantID != *wbChampion

					if shouldEnableReset {
						if winnerIDChanged(&gf2.PlayerAParticipantID, wbChampion) {
							changed = true
						}
						if winnerIDChanged(&gf2.PlayerBParticipantID, lbChampion) {
							changed = true
						}
						if autoCompletePendingMatch(gf2) {
							changed = true
						}
					} else {
						if winnerIDChanged(&gf2.PlayerAParticipantID, nil) {
							changed = true
						}
						if winnerIDChanged(&gf2.PlayerBParticipantID, nil) {
							changed = true
						}
						if gf2.WinnerParticipantID != nil {
							gf2.WinnerParticipantID = nil
							changed = true
						}
						if gf2.LiveMatchID != nil {
							gf2.LiveMatchID = nil
							changed = true
						}
						if gf2.StartedAt != nil {
							gf2.StartedAt = nil
							changed = true
						}
						if gf2.FinishedAt != nil {
							gf2.FinishedAt = nil
							changed = true
						}
						if gf2.Status != models.TournamentMatchPending {
							gf2.Status = models.TournamentMatchPending
							changed = true
						}
					}
				}
			}
		}
	}

	for i := range matches {
		match := matches[i]
		updates := map[string]any{
			"player_a_participant_id": match.PlayerAParticipantID,
			"player_b_participant_id": match.PlayerBParticipantID,
			"winner_participant_id":   match.WinnerParticipantID,
			"status":                  match.Status,
			"finished_at":             match.FinishedAt,
			"started_at":              match.StartedAt,
		}
		if match.Status == models.TournamentMatchCompleted {
			updates["live_match_id"] = nil
		} else {
			updates["live_match_id"] = match.LiveMatchID
		}
		if err := tx.Model(&models.TournamentMatch{}).
			Where("id = ?", match.ID).
			Updates(updates).Error; err != nil {
			return err
		}
	}

	shouldFinish := false
	gf1 := grandFinal[1]
	gf2 := grandFinal[2]
	if gf1 != nil && gf1.Status == models.TournamentMatchCompleted {
		wbChampion := matchWinnerParticipantID(winners[maxWinnersRound][1])
		if gf2 == nil {
			shouldFinish = true
		} else if gf1.WinnerParticipantID != nil && wbChampion != nil && *gf1.WinnerParticipantID == *wbChampion {
			shouldFinish = true
		} else if gf2.Status == models.TournamentMatchCompleted {
			shouldFinish = true
		}
	}

	now := time.Now().UTC()
	if shouldFinish {
		if err := tx.Model(&models.Tournament{}).
			Where("id = ?", tournament.ID).
			Updates(map[string]any{
				"status":   models.TournamentStatusFinished,
				"ended_at": now,
			}).Error; err != nil {
			return err
		}
	} else if tournament.Status == models.TournamentStatusFinished {
		if err := tx.Model(&models.Tournament{}).
			Where("id = ?", tournament.ID).
			Updates(map[string]any{
				"status":   models.TournamentStatusActive,
				"ended_at": nil,
			}).Error; err != nil {
			return err
		}
	}

	return syncParticipantEliminationState(tx, tournament.ID, matches, 2)
}

func winnerIDChanged(dst **uint, src *uint) bool {
	if *dst == nil && src == nil {
		return false
	}
	if *dst != nil && src != nil && **dst == *src {
		return false
	}

	if src == nil {
		*dst = nil
		return true
	}

	value := *src
	*dst = &value
	return true
}

func roundSlotKey(round, slot int) string {
	return fmt.Sprintf("%d:%d", round, slot)
}

func autoCompletePendingMatch(match *models.TournamentMatch) bool {
	if match == nil || match.Status != models.TournamentMatchPending {
		return false
	}

	left := match.PlayerAParticipantID
	right := match.PlayerBParticipantID
	now := time.Now().UTC()

	switch {
	case left != nil && right == nil:
		match.WinnerParticipantID = left
		match.Status = models.TournamentMatchCompleted
		match.FinishedAt = &now
		match.LiveMatchID = nil
		return true
	case left == nil && right != nil:
		match.WinnerParticipantID = right
		match.Status = models.TournamentMatchCompleted
		match.FinishedAt = &now
		match.LiveMatchID = nil
		return true
	case left == nil && right == nil:
		match.WinnerParticipantID = nil
		match.Status = models.TournamentMatchCompleted
		match.FinishedAt = &now
		match.LiveMatchID = nil
		return true
	default:
		return false
	}
}

func matchWinnerParticipantID(match *models.TournamentMatch) *uint {
	if match == nil || match.Status != models.TournamentMatchCompleted || match.WinnerParticipantID == nil {
		return nil
	}
	value := *match.WinnerParticipantID
	return &value
}

func loserParticipantID(match *models.TournamentMatch) *uint {
	if match == nil || match.Status != models.TournamentMatchCompleted || match.WinnerParticipantID == nil {
		return nil
	}
	return opponentOfWinner(match, *match.WinnerParticipantID)
}

func syncParticipantEliminationState(tx *gorm.DB, tournamentID uint, matches []models.TournamentMatch, eliminateAfterLosses int) error {
	if eliminateAfterLosses < 1 {
		eliminateAfterLosses = 1
	}

	lossesByParticipant := make(map[uint]int)
	for _, match := range matches {
		if match.Status != models.TournamentMatchCompleted || match.WinnerParticipantID == nil {
			continue
		}
		if match.PlayerAParticipantID != nil && *match.PlayerAParticipantID != *match.WinnerParticipantID {
			lossesByParticipant[*match.PlayerAParticipantID]++
		}
		if match.PlayerBParticipantID != nil && *match.PlayerBParticipantID != *match.WinnerParticipantID {
			lossesByParticipant[*match.PlayerBParticipantID]++
		}
	}

	if err := tx.Model(&models.TournamentParticipant{}).
		Where("tournament_id = ?", tournamentID).
		Update("eliminated_at", nil).Error; err != nil {
		return err
	}

	now := time.Now().UTC()
	for participantID, losses := range lossesByParticipant {
		if losses < eliminateAfterLosses {
			continue
		}
		if err := tx.Model(&models.TournamentParticipant{}).
			Where("id = ? AND tournament_id = ?", participantID, tournamentID).
			Update("eliminated_at", now).Error; err != nil {
			return err
		}
	}

	return nil
}

func numberOfRounds(bracketSize int) int {
	rounds := 0
	for bracketSize > 1 {
		bracketSize >>= 1
		rounds++
	}
	if rounds < 1 {
		return 1
	}
	return rounds
}

func doubleEliminationLosersRoundMatchCount(bracketSize, losersRound int) int {
	if bracketSize <= 1 || losersRound <= 0 {
		return 0
	}
	// Odd/even loser rounds in each phase have the same number of matches:
	// R1/R2 -> N/4, R3/R4 -> N/8, ...
	divisorPower := (losersRound + 3) / 2
	matches := bracketSize >> divisorPower
	if matches < 1 {
		return 1
	}
	return matches
}

func intPtr(v int) *int {
	value := v
	return &value
}

func splitProviderID(playerID string) (string, string) {
	parts := strings.SplitN(playerID, ":", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return "", ""
}

func opponentOfWinner(match *models.TournamentMatch, winnerParticipantID uint) *uint {
	if match == nil {
		return nil
	}
	if match.PlayerAParticipantID != nil && *match.PlayerAParticipantID == winnerParticipantID {
		return match.PlayerBParticipantID
	}
	if match.PlayerBParticipantID != nil && *match.PlayerBParticipantID == winnerParticipantID {
		return match.PlayerAParticipantID
	}
	return nil
}

func generateUniqueTournamentSlug(db *gorm.DB) (string, error) {
	for attempts := 0; attempts < 10; attempts++ {
		token, err := generateSecureToken(8)
		if err != nil {
			return "", err
		}
		slug := strings.ToLower(strings.ReplaceAll(token, "_", "x"))

		var count int64
		if err := db.Model(&models.Tournament{}).Where("slug = ?", slug).Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return slug, nil
		}
	}
	return "", fmt.Errorf("failed to generate unique tournament slug")
}

func generateSecureToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func nextPowerOfTwo(n int) int {
	if n <= 1 {
		return 1
	}
	p := 1
	for p < n {
		p <<= 1
	}
	return p
}
