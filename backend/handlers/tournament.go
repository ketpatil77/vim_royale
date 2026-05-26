package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"vim_royale/backend/config"
	database "vim_royale/backend/db"
	"vim_royale/backend/middleware"
	"vim_royale/backend/models"
	"vim_royale/backend/services"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

type createTournamentRequest struct {
	Name       string                           `json:"name"`
	MaxPlayers int                              `json:"maxPlayers"`
	Format     string                           `json:"format"`
	Settings   *createTournamentSettingsRequest `json:"settings"`
}

type createTournamentSettingsRequest struct {
	GrandFinalReset *bool `json:"grandFinalReset"`
	GroupSize       *int  `json:"groupSize"`
	AdvancePerGroup *int  `json:"advancePerGroup"`
}

type joinTournamentRequest struct {
	InviteToken string `json:"inviteToken"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
}

type setLockRequest struct {
	Locked *bool `json:"locked"`
}

type seedTournamentRequest struct {
	ParticipantIDs []uint `json:"participantIds"`
}

type reportTournamentMatchRequest struct {
	WinnerParticipantID uint `json:"winnerParticipantId"`
}

func CreateTournament(c *gin.Context) {
	userIDValue, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}
	hostUserID, ok := userIDValue.(uint)
	if !ok || hostUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return
	}

	var req createTournamentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	format := models.TournamentFormat(req.Format)
	if strings.TrimSpace(req.Format) == "" {
		format = models.TournamentFormatSingleElimination
	}

	tournament, inviteToken, err := database.CreateTournament(db, database.CreateTournamentInput{
		HostUserID:      hostUserID,
		Name:            req.Name,
		MaxPlayers:      req.MaxPlayers,
		Format:          format,
		GrandFinalReset: tournamentSettingGrandFinalReset(req.Settings),
		GroupSize:       tournamentSettingGroupSize(req.Settings),
		AdvancePerGroup: tournamentSettingAdvancePerGroup(req.Settings),
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"tournament":  tournamentResponse(tournament),
		"inviteToken": inviteToken,
		"inviteLink":  buildInviteLink(tournament.Slug, inviteToken),
	})
}

func JoinTournament(c *gin.Context) {
	tournamentID, ok := parseTournamentIDParam(c)
	if !ok {
		return
	}

	var req joinTournamentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(req.InviteToken) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "inviteToken is required"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	user, _ := optionalUserFromCookie(c, db)
	var userID *uint
	if user != nil {
		userID = &user.ID
	}

	sessionToken := tournamentSessionToken(c)

	result, err := database.JoinTournament(db, database.JoinTournamentInput{
		TournamentID: tournamentID,
		InviteToken:  strings.TrimSpace(req.InviteToken),
		UserID:       userID,
		SessionToken: sessionToken,
		DisplayName:  req.DisplayName,
		AvatarURL:    req.AvatarURL,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tournament":         tournamentResponse(result.Tournament),
		"participant":        participantResponse(result.Participant),
		"guestSessionToken":  result.GuestSessionToken,
		"tournamentAccessBy": accessMode(userID, result.GuestSessionToken),
	})
	services.PublishTournamentEvent(tournamentID, "participant_joined")
}

func GetTournament(c *gin.Context) {
	tournamentID, ok := parseTournamentIDParam(c)
	if !ok {
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	tournament, err := database.GetTournamentByID(db, tournamentID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == gorm.ErrRecordNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": "tournament not found"})
		return
	}

	user, _ := optionalUserFromCookie(c, db)
	var userID *uint
	if user != nil {
		userID = &user.ID
	}
	sessionToken := tournamentSessionToken(c)

	participant, err := database.FindTournamentParticipantForAccess(db, tournament.ID, userID, sessionToken)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a participant in this tournament"})
		return
	}

	participants, err := database.GetTournamentParticipants(db, tournament.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load participants"})
		return
	}
	matches, err := database.GetTournamentMatches(db, tournament.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load matches"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tournament":   tournamentResponse(tournament),
		"participant":  participantResponse(participant),
		"participants": participantsResponse(participants),
		"matches":      matches,
	})
}

func GetTournamentBySlug(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing slug"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	tournament, err := database.GetTournamentBySlug(db, slug)
	if err != nil {
		status := http.StatusInternalServerError
		if err == gorm.ErrRecordNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": "tournament not found"})
		return
	}

	user, _ := optionalUserFromCookie(c, db)
	var userID *uint
	if user != nil {
		userID = &user.ID
	}
	sessionToken := tournamentSessionToken(c)

	participant, accessErr := database.FindTournamentParticipantForAccess(db, tournament.ID, userID, sessionToken)
	if accessErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"tournament":       tournamentResponse(tournament),
			"requiresJoin":     true,
			"inviteTokenParam": "invite",
		})
		return
	}

	participants, err := database.GetTournamentParticipants(db, tournament.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load participants"})
		return
	}
	matches, err := database.GetTournamentMatches(db, tournament.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load matches"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tournament":   tournamentResponse(tournament),
		"participant":  participantResponse(participant),
		"participants": participantsResponse(participants),
		"matches":      matches,
		"requiresJoin": false,
	})
}

func SetTournamentLock(c *gin.Context) {
	tournamentID, ok := parseTournamentIDParam(c)
	if !ok {
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	userID, ok := requireHost(c, db, tournamentID)
	if !ok {
		return
	}
	_ = userID

	var req setLockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	locked := true
	if req.Locked != nil {
		locked = *req.Locked
	}

	if err := database.LockTournament(db, tournamentID, locked); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update lock state"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"locked": locked})
	services.PublishTournamentEvent(tournamentID, "lock_changed")
}

func SeedTournament(c *gin.Context) {
	tournamentID, ok := parseTournamentIDParam(c)
	if !ok {
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	if _, ok := requireHost(c, db, tournamentID); !ok {
		return
	}

	var req seedTournamentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := database.SeedTournament(db, tournamentID, req.ParticipantIDs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	participants, err := database.GetTournamentParticipants(db, tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load participants"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"participants": participantsResponse(participants)})
	services.PublishTournamentEvent(tournamentID, "seeds_updated")
}

func StartTournament(c *gin.Context) {
	tournamentID, ok := parseTournamentIDParam(c)
	if !ok {
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	if _, ok := requireHost(c, db, tournamentID); !ok {
		return
	}

	if err := database.StartTournament(db, tournamentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tournament, err := database.GetTournamentByID(db, tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load tournament"})
		return
	}
	matches, err := database.GetTournamentMatches(db, tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load matches"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tournament": tournamentResponse(tournament),
		"matches":    matches,
	})
	services.PublishTournamentEvent(tournamentID, "tournament_started")
}

func GetTournamentLeaderboard(c *gin.Context) {
	tournamentID, ok := parseTournamentIDParam(c)
	if !ok {
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	user, _ := optionalUserFromCookie(c, db)
	var userID *uint
	if user != nil {
		userID = &user.ID
	}
	sessionToken := tournamentSessionToken(c)

	if _, err := database.FindTournamentParticipantForAccess(db, tournamentID, userID, sessionToken); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a participant in this tournament"})
		return
	}

	leaderboard, err := database.GetTournamentLeaderboard(db, tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load leaderboard"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": leaderboard})
}

func StreamTournamentEvents(c *gin.Context) {
	tournamentID, ok := parseTournamentIDParam(c)
	if !ok {
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	user, _ := optionalUserFromCookie(c, db)
	var userID *uint
	if user != nil {
		userID = &user.ID
	}
	sessionToken := tournamentSessionToken(c)

	if _, err := database.FindTournamentParticipantForAccess(db, tournamentID, userID, sessionToken); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a participant in this tournament"})
		return
	}

	events, unsubscribe := services.SubscribeTournamentEvents(tournamentID)
	defer unsubscribe()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	c.Writer.Flush()

	c.SSEvent("tournament_update", services.TournamentEvent{
		Type:         "connected",
		TournamentID: tournamentID,
		TS:           time.Now().UTC().Unix(),
	})
	c.Writer.Flush()

	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	ctx := c.Request.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-events:
			if !ok {
				return
			}
			c.SSEvent("tournament_update", event)
			c.Writer.Flush()
		case <-heartbeat.C:
			c.SSEvent("heartbeat", gin.H{"ts": time.Now().UTC().Unix()})
			c.Writer.Flush()
		}
	}
}

func ReportTournamentMatch(c *gin.Context) {
	tournamentID, ok := parseTournamentIDParam(c)
	if !ok {
		return
	}

	matchIDRaw := strings.TrimSpace(c.Param("matchId"))
	matchID, err := strconv.ParseUint(matchIDRaw, 10, 32)
	if err != nil || matchID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid match id"})
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	if _, ok := requireHost(c, db, tournamentID); !ok {
		return
	}

	var req reportTournamentMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.WinnerParticipantID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "winnerParticipantId is required"})
		return
	}

	if err := database.ReportTournamentMatchWinner(db, tournamentID, uint(matchID), req.WinnerParticipantID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
	services.PublishTournamentEvent(tournamentID, "match_reported")
}

func RegenerateTournamentInvite(c *gin.Context) {
	tournamentID, ok := parseTournamentIDParam(c)
	if !ok {
		return
	}

	db, err := database.GetPostgresConnection()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database connection failed"})
		return
	}

	if _, ok := requireHost(c, db, tournamentID); !ok {
		return
	}

	tournament, err := database.GetTournamentByID(db, tournamentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tournament not found"})
		return
	}

	token, err := database.RegenerateTournamentInvite(db, tournamentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to regenerate invite token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"inviteToken": token,
		"inviteLink":  buildInviteLink(tournament.Slug, token),
	})
	services.PublishTournamentEvent(tournamentID, "invite_regenerated")
}

func requireHost(c *gin.Context, db *gorm.DB, tournamentID uint) (uint, bool) {
	userIDValue, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return 0, false
	}
	userID, ok := userIDValue.(uint)
	if !ok || userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user id"})
		return 0, false
	}

	isHost, err := database.IsTournamentHost(db, tournamentID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "host check failed"})
		return 0, false
	}
	if !isHost {
		c.JSON(http.StatusForbidden, gin.H{"error": "host access required"})
		return 0, false
	}
	return userID, true
}

func parseTournamentIDParam(c *gin.Context) (uint, bool) {
	raw := strings.TrimSpace(c.Param("id"))
	id64, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || id64 == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tournament id"})
		return 0, false
	}
	return uint(id64), true
}

func optionalUserFromCookie(c *gin.Context, db *gorm.DB) (*models.User, error) {
	tokenString, err := c.Cookie("token")
	if err != nil || strings.TrimSpace(tokenString) == "" {
		return nil, nil
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, nil
	}

	user, err := database.GetUserFromProvider(db, claims.Provider, claims.ProviderID)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func tournamentSessionToken(c *gin.Context) string {
	return strings.TrimSpace(c.GetHeader("X-Tournament-Session"))
}

func tournamentResponse(tournament *models.Tournament) gin.H {
	if tournament == nil {
		return gin.H{}
	}

	return gin.H{
		"id":         tournament.ID,
		"name":       tournament.Name,
		"slug":       tournament.Slug,
		"hostUserId": tournament.HostUserID,
		"status":     tournament.Status,
		"format":     tournament.Format,
		"settings": gin.H{
			"grandFinalReset": tournament.GrandFinalReset,
			"groupSize":       tournament.GroupSize,
			"advancePerGroup": tournament.AdvancePerGroup,
		},
		"maxPlayers": tournament.MaxPlayers,
		"isLocked":   tournament.IsLocked,
		"startedAt":  tournament.StartedAt,
		"endedAt":    tournament.EndedAt,
		"createdAt":  tournament.CreatedAt,
		"updatedAt":  tournament.UpdatedAt,
	}
}

func tournamentSettingGrandFinalReset(settings *createTournamentSettingsRequest) *bool {
	if settings == nil {
		return nil
	}
	return settings.GrandFinalReset
}

func tournamentSettingGroupSize(settings *createTournamentSettingsRequest) *int {
	if settings == nil {
		return nil
	}
	return settings.GroupSize
}

func tournamentSettingAdvancePerGroup(settings *createTournamentSettingsRequest) *int {
	if settings == nil {
		return nil
	}
	return settings.AdvancePerGroup
}

func participantResponse(participant *models.TournamentParticipant) gin.H {
	if participant == nil {
		return gin.H{}
	}

	return gin.H{
		"id":           participant.ID,
		"tournamentId": participant.TournamentID,
		"userId":       participant.UserID,
		"displayName":  participant.DisplayName,
		"avatarUrl":    participant.AvatarURL,
		"seed":         participant.Seed,
		"joinedAt":     participant.JoinedAt,
		"eliminatedAt": participant.EliminatedAt,
		"isHost":       participant.IsHost,
	}
}

func participantsResponse(participants []models.TournamentParticipant) []gin.H {
	items := make([]gin.H, 0, len(participants))
	for _, p := range participants {
		copy := p
		items = append(items, participantResponse(&copy))
	}
	return items
}

func accessMode(userID *uint, guestSessionToken string) string {
	if userID != nil {
		return "authenticated_user"
	}
	if strings.TrimSpace(guestSessionToken) != "" {
		return "guest_session"
	}
	return "none"
}

func buildInviteLink(slug, inviteToken string) string {
	base := strings.TrimRight(config.FrontendURL, "/")
	if base == "" {
		return "/t/" + slug + "?invite=" + inviteToken
	}
	return base + "/t/" + slug + "?invite=" + inviteToken
}
