package handlers

import (
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"
	"time"
	database "vim_royale/backend/db"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const guestSessionTTL = 24 * time.Hour

var guestNameWords = []string{
	"Falcon",
	"Tiger",
	"Comet",
	"Nova",
	"Pixel",
	"Cipher",
	"Ghost",
	"Rogue",
	"Shadow",
	"Vortex",
}

func CreateGuestSession(c *gin.Context) {
	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	guestID := uuid.NewString()
	displayName := generateGuestDisplayName()

	session, sessionToken, err := database.CreateGuestSession(db, guestID, displayName, guestSessionTTL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create guest session"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"guestId":      strings.TrimSpace(session.GuestID),
		"displayName":  strings.TrimSpace(session.DisplayName),
		"sessionToken": sessionToken,
		"expiresAt":    session.ExpiresAt,
	})
}

func generateGuestDisplayName() string {
	word := guestNameWords[rand.IntN(len(guestNameWords))]
	suffix := 100 + rand.IntN(900)
	return "Guest-" + word + "-" + strconv.Itoa(suffix)
}
