package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"vim_royale/backend/services"

	"github.com/gin-gonic/gin"
)

func SpectateMatch(hub *services.Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		matchID := c.Param("matchId")
		if matchID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Match ID is required"})
			return
		}

		snapshot, spectatorID, events, err := hub.SubscribeSpectator(matchID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Match is not live"})
			return
		}
		defer hub.UnsubscribeSpectator(matchID, spectatorID)

		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")
		c.Status(http.StatusOK)
		c.Writer.Flush()

		if err := writeSSEvent(c, "snapshot", snapshot); err != nil {
			return
		}
		c.Writer.Flush()

		heartbeat := time.NewTicker(15 * time.Second)
		defer heartbeat.Stop()

		for {
			select {
			case <-c.Request.Context().Done():
				return
			case event, ok := <-events:
				if !ok {
					return
				}
				if err := writeSSEvent(c, event.Name, event.Data); err != nil {
					return
				}
				c.Writer.Flush()
			case <-heartbeat.C:
				if err := writeSSEvent(c, "heartbeat", services.SpectatorHeartbeatPayload{TS: time.Now().UTC().Unix()}); err != nil {
					return
				}
				c.Writer.Flush()
			}
		}
	}
}

func writeSSEvent(c *gin.Context, name string, data any) error {
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}

	if _, err := fmt.Fprintf(c.Writer, "event: %s\n", name); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(c.Writer, "data: %s\n\n", raw); err != nil {
		return err
	}
	return nil
}
