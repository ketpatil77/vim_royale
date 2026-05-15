package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

var (
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string
	JWTSecret          string
	FrontendURL        string
)

func Load() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	GoogleClientID = getEnv("GOOGLE_CLIENT_ID", "")
	GoogleClientSecret = getEnv("GOOGLE_CLIENT_SECRET", "")
	GitHubClientID = getEnv("GITHUB_CLIENT_ID", "")
	GitHubClientSecret = getEnv("GITHUB_CLIENT_SECRET", "")
	JWTSecret = getEnv("JWT_SECRET", "")
	FrontendURL = getEnv("FRONTEND_URL", "")

	if JWTSecret == "" {
		log.Println("WARNING: JWT_SECRET not set")
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}