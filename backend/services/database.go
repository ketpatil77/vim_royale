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
		// Mark it inactive and remove it from queue immediately so it cannot be
		// matched during the reconnect window before Unregister is processed.
		delete(h.clientsByID, existing.ID)
		h.removeFromQueueLocked(existing)
		existing.closed = true
		if existing.Conn != nil {
			_ = existing.Conn.Close()
		}
		select {
		case h.Unregister <- existing:
		default:
			// ReadPump defer also enqueues Unregister after Conn.Close().
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
