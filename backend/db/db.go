package db

import (
	"fmt"
	"log"
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

		log.Printf("Connecting to database: %s", dsn)

		db, dbErr = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if dbErr != nil {
			dbErr = fmt.Errorf("failed to connect database: %w", dbErr)
			return
		}

		log.Println("Database connection established")

		if err := db.AutoMigrate(&models.User{}); err != nil {
			log.Printf("AutoMigrate error: %v", err)
		} else {
			log.Println("Database migration complete")
		}
	})
	return db, dbErr
}
