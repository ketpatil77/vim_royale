package services

import (
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"vim_royale/backend/config"
	database "vim_royale/backend/db"
	"vim_royale/backend/middleware"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 1024 * 1024
)

var uuidV4Like = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$`)
var providerIDLike = regexp.MustCompile(`^[a-z]+:.+$`)

type Client struct {
	ID                           string
	UserID                       uint
	DisplayName                  string
	AvatarURL                    string
	Rating                       int
	BotID                        string
	ForcedPlayerID               string
	PublicConnection             bool
	QueueType                    string
	TournamentID                 uint
	TournamentParticipantID      uint
	TournamentExpectedOpponentID string
	EnqueuedAt                   time.Time
	Conn                         *websocket.Conn
	Hub                          *Hub
	send                         chan []byte
	closed                       bool
	MatchID                      string
}

type ClientOptions struct {
	ForcedPlayerID   string
	PublicConnection bool
}

func NewClient(conn *websocket.Conn, hub *Hub, botID string, opts ClientOptions) *Client {
	return &Client{
		Conn:             conn,
		Hub:              hub,
		BotID:            botID,
		ForcedPlayerID:   opts.ForcedPlayerID,
		PublicConnection: opts.PublicConnection,
		send:             make(chan []byte, 256),
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		_ = c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		return c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	if err := c.expectHello(); err != nil {
		log.Printf("hello failed: %v", err)
		return
	}

	for {
		_, raw, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("unexpected close: %v", err)
			}
			return
		}

		var envelope Envelope
		if err := json.Unmarshal(raw, &envelope); err != nil {
			c.Hub.sendError(c, "invalid_json", "unable to parse message")
			continue
		}

		envelope.PlayerID = c.ID
		if envelope.MatchID == "" {
			envelope.MatchID = c.MatchID
		}
		c.Hub.EnqueueIncoming(InboundMessage{Client: c, Message: envelope})
	}
}

func (c *Client) expectHello() error {
	_ = c.Conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	_, raw, err := c.Conn.ReadMessage()
	if err != nil {
		return err
	}
	_ = c.Conn.SetReadDeadline(time.Now().Add(pongWait))

	var envelope Envelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		c.Hub.sendError(c, "invalid_json", "unable to parse HELLO")
		return err
	}

	if envelope.Type != MsgHello {
		c.Hub.sendError(c, "missing_hello", "first message must be HELLO")
		return errProtocol
	}

	var hello HelloPayload
	if err := json.Unmarshal(envelope.Payload, &hello); err != nil {
		c.Hub.sendError(c, "invalid_hello", "HELLO payload missing token or playerId")
		return err
	}

	var playerID string
	var guestDisplayName string

	if c.ForcedPlayerID != "" {
		playerID = c.ForcedPlayerID
	} else {
		if c.PublicConnection {
			if hello.TournamentID > 0 && hello.TournamentSessionToken != "" {
				guestPlayerID, err := resolveGuestPlayerIDFromTournamentSession(hello.TournamentID, hello.TournamentSessionToken)
				if err != nil {
					c.Hub.sendError(c, "invalid_tournament_session", "invalid tournament session")
					return errProtocol
				}
				playerID = guestPlayerID
			} else if strings.TrimSpace(hello.GuestSessionToken) != "" {
				guestPlayerID, guestName, err := resolveGuestPlayerIdentityFromSessionToken(hello.GuestSessionToken)
				if err != nil {
					c.Hub.sendError(c, "invalid_guest_session", "invalid guest session")
					return errProtocol
				}
				playerID = guestPlayerID
				guestDisplayName = guestName
			} else {
				c.Hub.sendError(c, "missing_guest_session", "guestSessionToken is required on public websocket")
				return errProtocol
			}
		} else {
			if hello.Token != "" {
				claims := &middleware.Claims{}
				token, err := jwt.ParseWithClaims(hello.Token, claims, func(token *jwt.Token) (interface{}, error) {
					return []byte(config.JWTSecret), nil
				}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))

				if err != nil || !token.Valid {
					c.Hub.sendError(c, "invalid_token", "invalid or expired token")
					return errProtocol
				}

				playerID = claims.Provider + ":" + claims.ProviderID
			} else if hello.PlayerID != "" {
				if !uuidV4Like.MatchString(hello.PlayerID) && !providerIDLike.MatchString(hello.PlayerID) {
					c.Hub.sendError(c, "invalid_player_id", "playerId must be a valid UUID or provider:id")
					return errProtocol
				}
				playerID = hello.PlayerID
			} else if hello.TournamentID > 0 && hello.TournamentSessionToken != "" {
				guestPlayerID, err := resolveGuestPlayerIDFromTournamentSession(hello.TournamentID, hello.TournamentSessionToken)
				if err != nil {
					c.Hub.sendError(c, "invalid_tournament_session", "invalid tournament session")
					return errProtocol
				}
				playerID = guestPlayerID
			} else {
				c.Hub.sendError(c, "missing_credentials", "provide token or playerId")
				return errProtocol
			}
		}
	}

	if hello.TournamentID > 0 && hello.TournamentSessionToken != "" {
		guestPlayerID, err := resolveGuestPlayerIDFromTournamentSession(hello.TournamentID, hello.TournamentSessionToken)
		if err != nil {
			c.Hub.sendError(c, "invalid_tournament_session", "invalid tournament session")
			return errProtocol
		}
		if playerID != guestPlayerID {
			c.Hub.sendError(c, "session_player_mismatch", "tournament session does not match player identity")
			return errProtocol
		}
	}

	if err := c.Hub.AttachIdentity(c, playerID); err != nil {
		c.Hub.sendError(c, "duplicate_player", "player already connected")
		return err
	}

	if guestDisplayName != "" && !providerIDLike.MatchString(playerID) {
		c.DisplayName = normalizeDisplayName(guestDisplayName)
	}
	if strings.TrimSpace(c.DisplayName) == "" && !providerIDLike.MatchString(playerID) {
		c.DisplayName = "Guest"
	}

	ack := HelloAckPayload{PlayerID: c.ID}
	c.Hub.mu.Lock()
	c.Hub.sendLocked(c, MsgHelloAck, "", c.ID, 0, ack)
	c.Hub.mu.Unlock()
	return nil
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		_ = c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				_ = c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) close() {
	c.Hub.Unregister <- c
	_ = c.Conn.Close()
}

func resolveGuestPlayerIDFromTournamentSession(tournamentID uint, sessionToken string) (string, error) {
	db, err := database.GetPostgresConnection()
	if err != nil {
		return "", err
	}

	participant, err := database.FindTournamentParticipantForAccess(db, tournamentID, nil, sessionToken)
	if err != nil {
		return "", err
	}
	if participant.GuestID == nil || *participant.GuestID == "" {
		return "", fmt.Errorf("session token is not for a guest participant")
	}

	return *participant.GuestID, nil
}

func resolveGuestPlayerIdentityFromSessionToken(sessionToken string) (string, string, error) {
	db, err := database.GetPostgresConnection()
	if err != nil {
		return "", "", err
	}

	session, err := database.FindGuestSessionByToken(db, sessionToken)
	if err != nil {
		return "", "", err
	}
	_ = database.TouchGuestSession(db, session.ID)

	displayName := normalizeDisplayName(session.DisplayName)
	return strings.TrimSpace(session.GuestID), displayName, nil
}
