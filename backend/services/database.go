package services

import (
	"fmt"
	"strings"

	database "vim_royale/backend/db"
)

func (h *Hub) AttachIdentity(client *Client, playerID string) error {
	bucketIdx := 0
	provider, providerID := splitProviderID(playerID)
	if provider != "" && providerID != "" {
		db, err := database.GetPostgresConnection()
		if err == nil {
			user, err := database.GetUserFromProvider(db, provider, providerID)
			if err == nil {
				b := int(user.Rating / 100)
				if b > 40 {
					b = 40
				}
				bucketIdx = b
			}
		}
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if existing, exists := h.clientsByID[playerID]; exists && existing != client {
		return fmt.Errorf("player_id_already_connected")
	}

	client.ID = playerID
	client.Rating = bucketIdx
	h.clientsByID[playerID] = client
	return nil
}

func splitProviderID(playerID string) (string, string) {
	parts := strings.SplitN(playerID, ":", 2)
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	return "", ""
}