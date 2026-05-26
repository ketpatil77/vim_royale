package database

import (
	"errors"
	"math"
	"strings"
	"time"
	"vim_royale/backend/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func CreateTimedScoreRun(db *gorm.DB, ownerUserID *uint, guestID string, difficulty string, ttl time.Duration) (*models.TimedScoreRun, string, error) {
	token, err := generateToken(24)
	if err != nil {
		return nil, "", err
	}

	now := time.Now().UTC()
	run := &models.TimedScoreRun{
		RunTokenHash: tokenHash(token),
		Difficulty:   strings.TrimSpace(strings.ToLower(difficulty)),
		OwnerUserID:  ownerUserID,
		GuestID:      strings.TrimSpace(guestID),
		StartedAt:    now,
		ExpiresAt:    now.Add(ttl),
	}

	if err := db.Create(run).Error; err != nil {
		return nil, "", err
	}

	return run, token, nil
}

func CompleteTimedScoreRunByToken(db *gorm.DB, token string, ownerUserID *uint, guestID string) (*models.TimedScoreRun, error) {
	hashed := tokenHash(strings.TrimSpace(token))
	now := time.Now().UTC()

	var updated models.TimedScoreRun
	err := db.Transaction(func(tx *gorm.DB) error {
		var run models.TimedScoreRun
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("run_token_hash = ?", hashed).First(&run).Error; err != nil {
			return err
		}

		if !run.ExpiresAt.After(now) || run.ConsumedAt != nil {
			return gorm.ErrRecordNotFound
		}

		if run.OwnerUserID != nil {
			if ownerUserID == nil || *run.OwnerUserID != *ownerUserID {
				return errors.New("run owner mismatch")
			}
		} else {
			if strings.TrimSpace(run.GuestID) == "" || strings.TrimSpace(guestID) == "" || run.GuestID != strings.TrimSpace(guestID) {
				return errors.New("guest ownership mismatch")
			}
		}

		if run.CompletedAt == nil {
			run.CompletedAt = &now
			if err := tx.Model(&run).Update("completed_at", now).Error; err != nil {
				return err
			}
		}

		updated = run
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &updated, nil
}

func ConsumeTimedScoreRunAndSave(db *gorm.DB, token string, userID uint, guestID string) (*models.TimedScore, *models.TimedScoreRun, error) {
	hashed := tokenHash(strings.TrimSpace(token))
	now := time.Now().UTC()

	var createdScore models.TimedScore
	var runCopy models.TimedScoreRun

	err := db.Transaction(func(tx *gorm.DB) error {
		var run models.TimedScoreRun
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("run_token_hash = ?", hashed).First(&run).Error; err != nil {
			return err
		}

		if !run.ExpiresAt.After(now) || run.ConsumedAt != nil || run.CompletedAt == nil {
			return gorm.ErrRecordNotFound
		}

		if run.OwnerUserID != nil && *run.OwnerUserID != userID {
			return errors.New("run owner mismatch")
		}
		if run.OwnerUserID == nil {
			if strings.TrimSpace(run.GuestID) == "" || strings.TrimSpace(guestID) == "" || run.GuestID != strings.TrimSpace(guestID) {
				return errors.New("guest ownership mismatch")
			}
		}

		durationSec := int(math.Round(run.CompletedAt.Sub(run.StartedAt).Seconds()))
		if durationSec < 1 {
			durationSec = 1
		}
		if durationSec > 7200 {
			return errors.New("invalid run duration")
		}

		score := models.TimedScore{
			UserID:      userID,
			Difficulty:  run.Difficulty,
			TimeSeconds: durationSec,
			CompletedAt: *run.CompletedAt,
		}
		if err := tx.Create(&score).Error; err != nil {
			return err
		}

		claimedUserID := userID
		run.ConsumedAt = &now
		run.ClaimedUserID = &claimedUserID
		if run.OwnerUserID == nil {
			run.OwnerUserID = &claimedUserID
		}
		if err := tx.Model(&run).Updates(map[string]interface{}{
			"consumed_at":     now,
			"claimed_user_id": claimedUserID,
			"owner_user_id":   run.OwnerUserID,
		}).Error; err != nil {
			return err
		}

		createdScore = score
		runCopy = run
		return nil
	})

	if err != nil {
		return nil, nil, err
	}
	return &createdScore, &runCopy, nil
}
