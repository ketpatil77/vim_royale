package services

import (
	"strings"

	database "vim_royale/backend/db"
)

func (h *Hub) AttachIdentity(client *Client, playerID string) error {
	var displayName, avatarURL string
	rating := 1500
	var userID uint

	provider, providerID := splitProviderID(playerID)
	if provider != "" && providerID != "" {
		db, err := database.GetPostgresConnection()
		if err == nil {
			user, err := database.GetUserFromProvider(db, provider, providerID)
			if err == nil {
				userID = user.ID
				displayName = user.DisplayName
				avatarURL = user.AvatarURL
				rating = int(user.Rating)
			}
		}
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if existing, exists := h.clientsByID[playerID]; exists && existing != client {
		// Stale connection still registered — evict it and let the new one in.
		// This happens when a client reconnects before the hub has processed
		// the previous Unregister (common on 1 vCPU under any load).
		delete(h.clientsByID, existing.ID)
		existing.ID = ""
		select {
		case h.Unregister <- existing:
		default:
			// Unregister channel full — close the send channel directly
			// so WritePump exits cleanly
			select {
			case <-existing.send:
			default:
				close(existing.send)
			}
		}
	}

	client.ID = playerID
	client.UserID = userID
	client.DisplayName = displayName
	client.AvatarURL = avatarURL
	client.Rating = rating
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
