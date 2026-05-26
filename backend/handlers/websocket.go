package handlers

import (
	"log"
	"net/http"
	"net/url"
	"strings"

	"vim_royale/backend/config"
	"vim_royale/backend/services"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin == "" {
			return true
		}

		originURL, err := url.Parse(origin)
		if err != nil {
			return false
		}
		frontendURL, err := url.Parse(strings.TrimSpace(config.FrontendURL))
		if err != nil || frontendURL.Host == "" {
			return strings.EqualFold(originURL.Host, r.Host)
		}

		return strings.EqualFold(originURL.Scheme, frontendURL.Scheme) &&
			strings.EqualFold(originURL.Host, frontendURL.Host)
	},
}

func WsHandler(hub *services.Hub, isPublic bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("upgrade failed: %v", err)
			return
		}

		botID := c.Query("botId")
		forcedPlayerID := ""
		if !isPublic {
			provider, providerOK := c.Get("provider")
			providerID, providerIDOK := c.Get("providerID")
			if providerOK && providerIDOK {
				forcedPlayerID = strings.TrimSpace(provider.(string)) + ":" + strings.TrimSpace(providerID.(string))
			}
		}

		client := services.NewClient(conn, hub, botID, services.ClientOptions{
			ForcedPlayerID:   forcedPlayerID,
			PublicConnection: isPublic,
		})
		hub.Register <- client

		go client.WritePump()
		client.ReadPump()
	}
}
