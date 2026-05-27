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
	if len(config.TrustedProxies) == 0 {
		if err := r.SetTrustedProxies(nil); err != nil {
			log.Fatalf("failed to set trusted proxies: %v", err)
		}
	} else {
		if err := r.SetTrustedProxies(config.TrustedProxies); err != nil {
			log.Fatalf("failed to set trusted proxies: %v", err)
		}
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			config.FrontendURL,
		},
		AllowMethods:     []string{"GET", "POST", "OPTIONS", "PUT", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Tournament-Session", "X-Guest-Session"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	healthLimit := middleware.RateLimitMiddleware(10, 10*time.Second)
	publicLimit := middleware.RateLimitMiddleware(100, 10*time.Minute)
	tournamentReadLimit := middleware.RateLimitMiddleware(600, 10*time.Minute)
	tournamentJoinLimit := middleware.RateLimitMiddleware(60, 10*time.Minute)
	authLimit := middleware.RateLimitMiddleware(20, 10*time.Minute)
	writeLimit := middleware.RateLimitMiddleware(30, 10*time.Minute)
	wsLimit := middleware.RateLimitMiddleware(30, time.Minute)
	csrfProtected := middleware.CSRFMiddleware(config.FrontendURL)

	r.GET("/healthz", healthLimit, handlers.HealthzHandler)
	r.GET("/ws", wsLimit, handlers.AuthMiddleware(), handlers.WsHandler(hub, false))
	r.GET("/ws/public", wsLimit, handlers.WsHandler(hub, true))

	authRoutes := r.Group("/auth", authLimit)
	{
		authRoutes.GET("/google", handlers.AuthGoogleHandler)
		authRoutes.GET("/google/callback", handlers.AuthGoogleCallbackHandler)
		authRoutes.GET("/github", handlers.AuthGitHubHandler)
		authRoutes.GET("/github/callback", handlers.AuthGitHubCallbackHandler)
		authRoutes.GET("/me", handlers.AuthMiddleware(), handlers.AuthMeHandler)
		authRoutes.GET("/me/keybindings", handlers.AuthMiddleware(), handlers.GetMyVimKeybindings)
		authRoutes.POST("/logout", csrfProtected, handlers.AuthLogoutHandler)
		authRoutes.PATCH("/me", writeLimit, handlers.AuthMiddleware(), csrfProtected, handlers.UpdateUserProfile)
		authRoutes.PATCH("/me/keybindings", writeLimit, handlers.AuthMiddleware(), csrfProtected, handlers.UpdateMyVimKeybindings)
		authRoutes.GET("/timed-scores/best", handlers.AuthMiddleware(), handlers.GetTimedScoreBests)
		authRoutes.POST("/timed-scores/save", writeLimit, handlers.AuthMiddleware(), csrfProtected, handlers.SaveTimedScore)
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

	publicWriteRoutes := r.Group("/", writeLimit, csrfProtected)
	{
		publicWriteRoutes.POST("/guest/session", handlers.CreateGuestSession)
		publicWriteRoutes.POST("/timed-scores/run", handlers.StartTimedScoreRun)
		publicWriteRoutes.POST("/timed-scores/complete", handlers.CompleteTimedScoreRun)
	}

	tournamentPublic := r.Group("/tournaments")
	{
		tournamentPublic.GET("/slug/:slug", tournamentReadLimit, handlers.GetTournamentBySlug)
		tournamentPublic.GET("/:id", tournamentReadLimit, handlers.GetTournament)
		tournamentPublic.POST("/:id/join", tournamentJoinLimit, handlers.JoinTournament)
		tournamentPublic.GET("/:id/leaderboard", tournamentReadLimit, handlers.GetTournamentLeaderboard)
		tournamentPublic.GET("/:id/events", tournamentReadLimit, handlers.StreamTournamentEvents)
	}

	tournamentHost := r.Group("/tournaments", writeLimit, handlers.AuthMiddleware(), csrfProtected)
	{
		tournamentHost.POST("", handlers.CreateTournament)
		tournamentHost.POST("/:id/lock", handlers.SetTournamentLock)
		tournamentHost.POST("/:id/seed", handlers.SeedTournament)
		tournamentHost.POST("/:id/start", handlers.StartTournament)
		tournamentHost.POST("/:id/invite/regenerate", handlers.RegenerateTournamentInvite)
		tournamentHost.POST("/:id/matches/:matchId/report", handlers.ReportTournamentMatch)
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
