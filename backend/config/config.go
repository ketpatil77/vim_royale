package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

var (
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string
	JWTSecret          string
	FrontendURL        string
	TrustedProxies     []string
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
	TrustedProxies = splitCSV(os.Getenv("TRUSTED_PROXIES"))

	if JWTSecret == "" {
		log.Fatal("JWT_SECRET is required")
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func splitCSV(value string) []string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	parts := strings.Split(trimmed, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			values = append(values, item)
		}
	}
	if len(values) == 0 {
		return nil
	}
	return values
}
