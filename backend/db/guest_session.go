package database

import (
	"errors"
	"strings"
	"time"
	"vim_royale/backend/models"

	"gorm.io/gorm"
)

func CreateGuestSession(db *gorm.DB, guestID string, displayName string, ttl time.Duration) (*models.GuestSession, string, error) {
	token, err := generateToken(24)
	if err != nil {
		return nil, "", err
	}

	now := time.Now().UTC()
	session := &models.GuestSession{
		GuestID:          strings.TrimSpace(guestID),
		DisplayName:      strings.TrimSpace(displayName),
		SessionTokenHash: tokenHash(token),
		ExpiresAt:        now.Add(ttl),
		LastSeenAt:       now,
	}

	if err := db.Create(session).Error; err != nil {
		return nil, "", err
	}
	return session, token, nil
}

func FindGuestSessionByToken(db *gorm.DB, token string) (*models.GuestSession, error) {
	hashed := tokenHash(strings.TrimSpace(token))
	var session models.GuestSession
	if err := db.Where("session_token_hash = ?", hashed).First(&session).Error; err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if session.RevokedAt != nil || !session.ExpiresAt.After(now) {
		return nil, gorm.ErrRecordNotFound
	}

	return &session, nil
}

func TouchGuestSession(db *gorm.DB, sessionID uint) error {
	if sessionID == 0 {
		return nil
	}
	now := time.Now().UTC()
	return db.Model(&models.GuestSession{}).
		Where("id = ?", sessionID).
		Update("last_seen_at", now).
		Error
}

func FindGuestSessionByGuestID(db *gorm.DB, guestID string) (*models.GuestSession, error) {
	trimmed := strings.TrimSpace(guestID)
	if trimmed == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var session models.GuestSession
	if err := db.Where("guest_id = ?", trimmed).Order("id desc").First(&session).Error; err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if session.RevokedAt != nil || !session.ExpiresAt.After(now) {
		return nil, gorm.ErrRecordNotFound
	}
	return &session, nil
}

func ValidateGuestTokenMatchesGuestID(db *gorm.DB, token string, guestID string) error {
	session, err := FindGuestSessionByToken(db, token)
	if err != nil {
		return err
	}
	if session.GuestID != strings.TrimSpace(guestID) {
		return errors.New("guest token does not match guest id")
	}
	return nil
}
