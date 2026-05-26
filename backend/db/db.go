package database

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"sync"

	"vim_royale/backend/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	db     *gorm.DB
	dbOnce sync.Once
	dbErr  error
)

func GetPostgresConnection() (*gorm.DB, error) {
	dbOnce.Do(func() {
		dsn := os.Getenv("DATABASE_URL")
		if dsn == "" {
			dsn = "postgres://postgres:postgres@localhost:5432/vim_royale?sslmode=disable"
		}

		log.Printf("Connecting to database: %s", redactDSN(dsn))

		db, dbErr = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if dbErr != nil {
			dbErr = fmt.Errorf("failed to connect database: %w", dbErr)
			return
		}

		log.Println("Database connection established")

		if err := db.AutoMigrate(
			&models.User{},
			&models.Match{},
			&models.MatchKeystroke{},
			&models.TimedScore{},
			&models.TimedScoreRun{},
			&models.GuestSession{},
			&models.Tournament{},
			&models.TournamentParticipant{},
			&models.TournamentMatch{},
		); err != nil {
			log.Printf("AutoMigrate error: %v", err)
		} else {
			log.Println("Database migration complete")
		}
	})
	return db, dbErr
}

func redactDSN(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "<invalid-dsn>"
	}
	if parsed.User != nil {
		username := parsed.User.Username()
		if username != "" {
			parsed.User = url.UserPassword(username, "REDACTED")
		} else {
			parsed.User = nil
		}
	}
	return parsed.String()
}
