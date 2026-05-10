package database

import (
	"fmt"
	"math/rand/v2"
	"strings"

	"gorm.io/gorm"
)

var adjectives = []string{
	"silent", "rapid", "dark", "retro", "fuzzy", "hidden",
	"neon", "rusty", "lazy", "swift",
}

var vimWords = []string{
	"vim", "nvim", "hjkl", "buffer", "macro",
	"grep", "tmux", "yank", "tty", "sed",
}

var suffixes = []string{
	"wizard", "ghost", "nomad", "pirate",
	"samurai", "runner", "hacker", "monk",
}

const (
	maxAttempts = 10
	minSuffix   = 1000
	maxSuffix   = 9999
	// After this attempt threshold, widen the number range to reduce collisions.
	widenAttempt = 5
	widenedMax   = 999999
)

func generateUsername(widenRange bool) string {
	ceiling := maxSuffix
	if widenRange {
		ceiling = widenedMax
	}
	number := rand.IntN(ceiling-minSuffix+1) + minSuffix
	return strings.ToLower(fmt.Sprintf(
		"%s%s%s%d",
		adjectives[rand.IntN(len(adjectives))],
		vimWords[rand.IntN(len(vimWords))],
		suffixes[rand.IntN(len(suffixes))],
		number,
	))
}

func CreateUniqueUsername(db *gorm.DB) (string, error) {
	for i := range maxAttempts {
		username := generateUsername(i >= widenAttempt)

		var count int64
		if err := db.Table("users").
			Where("username = ?", username).
			Count(&count).Error; err != nil {
			return "", fmt.Errorf("username uniqueness check failed: %w", err)
		}

		if count == 0 {
			return username, nil
		}
	}

	return "", fmt.Errorf("failed to generate unique username after %d attempts", maxAttempts)
}
