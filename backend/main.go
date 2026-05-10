package main

import (
	"log"
	"math/rand"
	"os"
	"time"

	"vim_royale/backend/config"
	"vim_royale/backend/handlers"
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
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS", "PUT", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/healthz", handlers.HealthzHandler)
	r.GET("/ws", handlers.WsHandler(hub))

	r.GET("/auth/google", handlers.AuthGoogleHandler)
	r.GET("/auth/google/callback", handlers.AuthGoogleCallbackHandler)
	r.GET("/auth/github", handlers.AuthGitHubHandler)
	r.GET("/auth/github/callback", handlers.AuthGitHubCallbackHandler)
	r.GET("/auth/me", handlers.AuthMiddleware(), handlers.AuthMeHandler)
	r.POST("/auth/logout", handlers.AuthLogoutHandler)
	r.PATCH("/auth/me", handlers.AuthMiddleware(), handlers.UpdateUserProfile)
	r.GET("/leaderboard", handlers.GetLeaderboard)

	r.GET("/users/:username", handlers.GetUserFromUsername)
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	log.Printf("websocket server listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
