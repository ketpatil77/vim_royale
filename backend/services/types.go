package services

import (
	"encoding/json"
	"time"
)

type MessageType string

const (
	MsgHello          MessageType = "HELLO"
	MsgHelloAck       MessageType = "HELLO_ACK"
	MsgQueueJoin      MessageType = "QUEUE_JOIN"
	MsgGameStart      MessageType = "GAME_START"
	MsgBufferUpdate   MessageType = "BUFFER_UPDATE"
	MsgPlayerFinished MessageType = "PLAYER_FINISHED"
	MsgGameOver       MessageType = "GAME_OVER"
	MsgError          MessageType = "ERROR"
)

type Envelope struct {
	Type      MessageType     `json:"type"`
	MatchID   string          `json:"matchId,omitempty"`
	PlayerID  string          `json:"playerId,omitempty"`
	Seq       int64           `json:"seq,omitempty"`
	Timestamp int64           `json:"timestamp,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
}

type HelloPayload struct {
	Token    string `json:"token,omitempty"`
	PlayerID string `json:"playerId,omitempty"`
}

type HelloAckPayload struct {
	PlayerID string `json:"playerId"`
}

type QueueJoinPayload struct{}

type GameStartPayload struct {
	MatchID         string `json:"matchId"`
	OpponentID      string `json:"opponentId"`
	OpponentName    string `json:"opponentName"`
	OpponentAvatar  string `json:"opponentAvatar"`
	OpponentRating  int    `json:"opponentRating"`
	Role            string `json:"role"`
	StartedAt       int64  `json:"startedAt"`
	TargetCode      string `json:"targetCode"`
	PollutedCode    string `json:"pollutedCode"`
}

type BufferUpdatePayload struct {
	Content string `json:"content"`
	Cursor  int    `json:"cursor,omitempty"`
}

type KeystrokeEntry struct {
	Ops       json.RawMessage `json:"ops"`
	Timestamp int64            `json:"timestamp"`
}

type KeystrokesData struct {
	PlayerA []KeystrokeEntry `json:"playerA"`
	PlayerB []KeystrokeEntry `json:"playerB"`
}

type PlayerFinishedPayload struct {
	FinalHash  string          `json:"finalHash,omitempty"`
	WPM        int             `json:"wpm,omitempty"`
	Accuracy   int             `json:"accuracy,omitempty"`
	Keystrokes *KeystrokesData `json:"keystrokes,omitempty"`
}

type GameOverPayload struct {
	MatchID         string  `json:"matchId"`
	WinnerID        string  `json:"winnerId"`
	LoserID         string  `json:"loserId"`
	WinnerName      string  `json:"winnerName"`
	WinnerAvatar    string  `json:"winnerAvatar"`
	WinnerNewRating float64 `json:"winnerNewRating"`
	WinnerDelta     float64 `json:"winnerDelta"`
	LoserName       string  `json:"loserName"`
	LoserAvatar     string  `json:"loserAvatar"`
	LoserNewRating  float64 `json:"loserNewRating"`
	LoserDelta      float64 `json:"loserDelta"`
	Reason          string  `json:"reason"`
	FinishedAt      int64   `json:"finishedAt"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type MatchStatus string

const (
	MatchWaiting  MatchStatus = "WAITING"
	MatchPlaying  MatchStatus = "PLAYING"
	MatchFinished MatchStatus = "FINISHED"
)

type Match struct {
	ID           string
	PlayerA      *Client
	PlayerB      *Client
	Status       MatchStatus
	TargetCode   string
	PollutedCode string
	StartedAt    time.Time
	FinishedAt   *time.Time
	WinnerID     string
	LastSeqByID  map[string]int64
}

type InboundMessage struct {
	Client  *Client
	Message Envelope
}

func (m *Match) opponentOf(client *Client) *Client {
	if m.PlayerA == client {
		return m.PlayerB
	}
	if m.PlayerB == client {
		return m.PlayerA
	}
	return nil
}