package main

import (
	"log"

	"vim_royale/backend/auth"
	"vim_royale/backend/middleware"

	"github.com/gin-gonic/gin"
)

func healthzHandler(c *gin.Context) {
	c.String(200, "ok")
}

func wsHandler(hub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("upgrade failed: %v", err)
			return
		}

		client := NewClient(conn, hub)
		hub.register <- client

		go client.writePump()
		client.readPump()
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
	email, _ := c.Get("email")

	c.JSON(200, gin.H{
		"id":       userID,
		"provider": provider,
		"email":    email,
	})
}

func authLogoutHandler(c *gin.Context) {
	c.SetCookie("token", "", -1, "/", "", false, true)
	c.JSON(200, gin.H{"message": "logged out"})
}

func authMiddleware() gin.HandlerFunc {
	return middleware.AuthRequired()
}

