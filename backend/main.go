package main

import (
	"log"
	"math/rand"
	"os"
	"time"

	"vim_royale/backend/config"
	"vim_royale/backend/handlers"
	"vim_royale/backend/middleware"
	"vim_royale/backend/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	config.Load()

	hub := services.NewHub()
	go hub.Run()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			config.FrontendURL,
		},
		AllowMethods:     []string{"GET", "POST", "OPTIONS", "PUT", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/healthz", middleware.RateLimitMiddleware(10, 10*time.Second), handlers.HealthzHandler)
	r.GET("/ws", handlers.AuthMiddleware(), handlers.WsHandler(hub))

	r.GET("/auth/google", handlers.AuthGoogleHandler)
	r.GET("/auth/google/callback", handlers.AuthGoogleCallbackHandler)
	r.GET("/auth/github", handlers.AuthGitHubHandler)
	r.GET("/auth/github/callback", handlers.AuthGitHubCallbackHandler)
	r.GET("/auth/me", handlers.AuthMiddleware(), handlers.AuthMeHandler)
	r.POST("/auth/logout", handlers.AuthLogoutHandler)
	r.PATCH("/auth/me", handlers.AuthMiddleware(), handlers.UpdateUserProfile)
	r.GET("/leaderboard", middleware.RateLimitMiddleware(100, 10*time.Minute), handlers.GetLeaderboard)

	r.GET("/users/:username", middleware.RateLimitMiddleware(100, 10*time.Minute), handlers.GetUserFromUsername)
	r.GET("/users/:username/matches", middleware.RateLimitMiddleware(100, 10*time.Minute), handlers.GetUserMatches)
	r.GET("/matches/:matchId/replay", middleware.RateLimitMiddleware(100, 10*time.Minute), handlers.GetMatchReplay)
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	log.Printf("websocket server listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
