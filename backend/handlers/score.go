package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"vim_royale/backend/config"
	database "vim_royale/backend/db"
	"vim_royale/backend/middleware"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

var allowedTimedDifficulties = map[string]bool{
	"beginner":     true,
	"intermediate": true,
	"advanced":     true,
	"expert":       true,
}

const (
	timedRunTTL = 2 * time.Hour
)

type StartTimedScoreRunRequest struct {
	Difficulty string `json:"difficulty"`
}

type CompleteTimedScoreRunRequest struct {
	RunToken string `json:"runToken"`
}

type SaveTimedScoreRequest struct {
	RunToken string `json:"runToken"`
}

func StartTimedScoreRun(c *gin.Context) {
	var req StartTimedScoreRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	difficulty := strings.TrimSpace(strings.ToLower(req.Difficulty))
	if !allowedTimedDifficulties[difficulty] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid difficulty"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	userID, guestID, resolveErr := resolveRunOwner(c, db)
	if resolveErr != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": resolveErr.Error()})
		return
	}

	run, runToken, err := database.CreateTimedScoreRun(db, userID, guestID, difficulty, timedRunTTL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start timed run"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"runToken":   runToken,
		"difficulty": run.Difficulty,
		"expiresAt":  run.ExpiresAt,
	})
}

func CompleteTimedScoreRun(c *gin.Context) {
	var req CompleteTimedScoreRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	runToken := strings.TrimSpace(req.RunToken)
	if runToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "runToken is required"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	userID, guestID, resolveErr := resolveRunOwner(c, db)
	if resolveErr != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": resolveErr.Error()})
		return
	}

	run, err := database.CompleteTimedScoreRunByToken(db, runToken, userID, guestID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
			return
		}
		if strings.Contains(err.Error(), "mismatch") {
			c.JSON(http.StatusForbidden, gin.H{"error": "run ownership mismatch"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete timed run"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"runToken":    runToken,
		"completedAt": run.CompletedAt,
		"expiresAt":   run.ExpiresAt,
	})
}

func SaveTimedScore(c *gin.Context) {
	provider, providerOK := c.Get("provider")
	providerID, providerIDOK := c.Get("providerID")
	if !providerOK || !providerIDOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req SaveTimedScoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	runToken := strings.TrimSpace(req.RunToken)
	if runToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "runToken is required"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	user, err := database.GetUserFromProvider(db, provider.(string), providerID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user"})
		return
	}

	guestID := ""
	guestSessionToken := strings.TrimSpace(c.GetHeader("X-Guest-Session"))
	if guestSessionToken != "" {
		if session, sessionErr := database.FindGuestSessionByToken(db, guestSessionToken); sessionErr == nil {
			guestID = strings.TrimSpace(session.GuestID)
			_ = database.TouchGuestSession(db, session.ID)
		}
	}

	score, run, err := database.ConsumeTimedScoreRunAndSave(db, runToken, user.ID, guestID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "run not found or already used"})
			return
		}
		if strings.Contains(err.Error(), "mismatch") {
			c.JSON(http.StatusForbidden, gin.H{"error": "run ownership mismatch"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to save score"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          score.ID,
		"difficulty":  score.Difficulty,
		"timeSeconds": score.TimeSeconds,
		"completedAt": score.CompletedAt,
		"runId":       run.ID,
	})
}

func GetTimedScoreBests(c *gin.Context) {
	provider, providerOK := c.Get("provider")
	providerID, providerIDOK := c.Get("providerID")
	if !providerOK || !providerIDOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	user, err := database.GetUserFromProvider(db, provider.(string), providerID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load user"})
		return
	}

	bestRows, err := database.GetBestTimedScoresByDifficulty(db, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load best scores"})
		return
	}

	response := gin.H{
		"beginner":     nil,
		"intermediate": nil,
		"advanced":     nil,
		"expert":       nil,
	}
	for _, row := range bestRows {
		if !allowedTimedDifficulties[row.Difficulty] {
			continue
		}
		response[row.Difficulty] = gin.H{
			"timeSeconds": row.TimeSeconds,
			"completedAt": row.CompletedAt,
		}
	}

	c.JSON(http.StatusOK, response)
}

func resolveRunOwner(c *gin.Context, db *gorm.DB) (*uint, string, error) {
	userID, userErr := optionalUserIDFromCookie(c)
	if userErr == nil && userID != nil {
		return userID, "", nil
	}

	guestSessionToken := strings.TrimSpace(c.GetHeader("X-Guest-Session"))
	if guestSessionToken == "" {
		return nil, "", fmt.Errorf("guest session token is required")
	}

	session, err := database.FindGuestSessionByToken(db, guestSessionToken)
	if err != nil {
		return nil, "", fmt.Errorf("invalid guest session")
	}
	_ = database.TouchGuestSession(db, session.ID)
	return nil, session.GuestID, nil
}

func optionalUserIDFromCookie(c *gin.Context) (*uint, error) {
	tokenString, err := c.Cookie("token")
	if err != nil || strings.TrimSpace(tokenString) == "" {
		return nil, fmt.Errorf("missing auth token")
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.JWTSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid auth token")
	}

	id := claims.UserID
	if id == 0 {
		return nil, fmt.Errorf("invalid user id")
	}
	return &id, nil
}
