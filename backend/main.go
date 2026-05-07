package main

import (
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"vim_royale/backend/config"
	"vim_royale/backend/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	rand.Seed(time.Now().UnixNano())

	config.Load()

	hub := services.NewHub()
	go hub.Run()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/healthz", healthzHandler)
	r.GET("/ws", wsHandler(hub))

	r.GET("/auth/google", authGoogleHandler)
	r.GET("/auth/google/callback", authGoogleCallbackHandler)
	r.GET("/auth/github", authGitHubHandler)
	r.GET("/auth/github/callback", authGitHubCallbackHandler)
	r.GET("/auth/me", authMiddleware(), authMeHandler)
	r.POST("/auth/logout", authLogoutHandler)

	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = ":8080"
	}

	log.Printf("websocket server listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}


