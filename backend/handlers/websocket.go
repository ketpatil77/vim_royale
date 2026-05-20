package handlers

import (
	"log"
	"net/http"

	"vim_royale/backend/services"

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

func WsHandler(hub *services.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("upgrade failed: %v", err)
			return
		}

		botID := c.Query("botId")
		client := services.NewClient(conn, hub, botID)
		hub.Register <- client

		go client.WritePump()
		client.ReadPump()
	}
}
