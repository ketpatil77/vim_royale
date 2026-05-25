package main

import (
	"log"
	"math/rand"
	"os"
	"path/filepath"
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

	if err := services.InitBotManager(filepath.Join("data", "bots")); err != nil {
		log.Printf("bot manager init warning: %v", err)
	}

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

	healthLimit := middleware.RateLimitMiddleware(10, 10*time.Second)
	publicLimit := middleware.RateLimitMiddleware(100, 10*time.Minute)
	authLimit := middleware.RateLimitMiddleware(20, 10*time.Minute)
	writeLimit := middleware.RateLimitMiddleware(30, 10*time.Minute)
	wsLimit := middleware.RateLimitMiddleware(30, time.Minute)

	r.GET("/healthz", healthLimit, handlers.HealthzHandler)
	r.GET("/ws", wsLimit, handlers.AuthMiddleware(), handlers.WsHandler(hub))

	authRoutes := r.Group("/auth", authLimit)
	{
		authRoutes.GET("/google", handlers.AuthGoogleHandler)
		authRoutes.GET("/google/callback", handlers.AuthGoogleCallbackHandler)
		authRoutes.GET("/github", handlers.AuthGitHubHandler)
		authRoutes.GET("/github/callback", handlers.AuthGitHubCallbackHandler)
		authRoutes.GET("/me", handlers.AuthMiddleware(), handlers.AuthMeHandler)
		authRoutes.POST("/logout", handlers.AuthLogoutHandler)
		authRoutes.PATCH("/me", writeLimit, handlers.AuthMiddleware(), handlers.UpdateUserProfile)
	}

	publicRoutes := r.Group("/", publicLimit)
	{
		publicRoutes.GET("/leaderboard", handlers.GetLeaderboard(hub))
		publicRoutes.GET("/users/:username", handlers.GetUserFromUsername)
		publicRoutes.GET("/users/:username/live", handlers.GetUserLiveStatus(hub))
		publicRoutes.GET("/users/:username/matches", handlers.GetUserMatches)
		publicRoutes.GET("/matches/:matchId/spectate", handlers.SpectateMatch(hub))
		publicRoutes.GET("/matches/:matchId/replay", handlers.GetMatchReplay)
	}
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	log.Printf("websocket server listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
