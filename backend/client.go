package main

import (
	"encoding/json"
	"log"
	"regexp"
	"time"

	"vim_royale/backend/config"
	"vim_royale/backend/middleware"

	"github.com/gorilla/websocket"
	"github.com/golang-jwt/jwt/v5"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 1024 * 1024
)

var uuidV4Like = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-5][a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$`)

type Client struct {
	ID      string
	Conn    *websocket.Conn
	Hub     *Hub
	send    chan []byte
	MatchID string
}

func NewClient(conn *websocket.Conn, hub *Hub) *Client {
	return &Client{
		Conn: conn,
		Hub:  hub,
		send: make(chan []byte, 256),
	}
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
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

	if hello.Token != "" {
		claims := &middleware.Claims{}
		token, err := jwt.ParseWithClaims(hello.Token, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(config.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.Hub.sendError(c, "invalid_token", "invalid or expired token")
			return errProtocol
		}

		playerID = claims.Provider + ":" + claims.ProviderID
	} else if hello.PlayerID != "" {
		if !uuidV4Like.MatchString(hello.PlayerID) {
			c.Hub.sendError(c, "invalid_player_id", "playerId must be a valid UUID")
			return errProtocol
		}
		playerID = hello.PlayerID
	} else {
		c.Hub.sendError(c, "missing_credentials", "provide token or playerId")
		return errProtocol
	}

	if err := c.Hub.AttachIdentity(c, playerID); err != nil {
		c.Hub.sendError(c, "duplicate_player", "player already connected")
		return err
	}

	ack := HelloAckPayload{PlayerID: c.ID}
	c.Hub.mu.Lock()
	c.Hub.sendLocked(c, MsgHelloAck, "", c.ID, 0, ack)
	c.Hub.mu.Unlock()
	return nil
}

func (c *Client) writePump() {
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
	c.Hub.unregister <- c
	_ = c.Conn.Close()
}
