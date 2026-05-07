package main

import (
	"log"

	"vim_royale/backend/auth"
	"vim_royale/backend/middleware"
	"vim_royale/backend/services"

	"github.com/gin-gonic/gin"
)

func healthzHandler(c *gin.Context) {
	c.String(200, "ok")
}

func wsHandler(hub *services.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("upgrade failed: %v", err)
			return
		}

		client := services.NewClient(conn, hub)
		hub.Register <- client

		go client.WritePump()
		client.ReadPump()
	}
}

func authGoogleHandler(c *gin.Context) {
	auth.GoogleLogin(c)
}

func authGoogleCallbackHandler(c *gin.Context) {
	auth.GoogleCallback(c)
}

func authGitHubHandler(c *gin.Context) {
	auth.GitHubLogin(c)
}

func authGitHubCallbackHandler(c *gin.Context) {
	auth.GitHubCallback(c)
}

func authMeHandler(c *gin.Context) {
	userID, _ := c.Get("userID")
	provider, _ := c.Get("provider")
	providerID, _ := c.Get("providerID")
	email, _ := c.Get("email")

	c.JSON(200, gin.H{
		"id":         userID,
		"provider":   provider,
		"providerId": providerID,
		"email":      email,
	})
}

func authLogoutHandler(c *gin.Context) {
	c.SetCookie("token", "", -1, "/", "", false, true)
	c.JSON(200, gin.H{"message": "logged out"})
}

func authMiddleware() gin.HandlerFunc {
	return middleware.AuthRequired()
}
