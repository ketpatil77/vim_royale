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
	MsgBotGameStart   MessageType = "BOT_GAME_START"
	MsgBufferUpdate   MessageType = "BUFFER_UPDATE"
	MsgPlayerFinished MessageType = "PLAYER_FINISHED"
	MsgGameOver       MessageType = "GAME_OVER"
	MsgSpectatorCount MessageType = "SPECTATOR_COUNT"
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
	Token                  string `json:"token,omitempty"`
	PlayerID               string `json:"playerId,omitempty"`
	GuestName              string `json:"guestName,omitempty"`
	GuestSessionToken      string `json:"guestSessionToken,omitempty"`
	TournamentID           uint   `json:"tournamentId,omitempty"`
	TournamentSessionToken string `json:"tournamentSessionToken,omitempty"`
}

type HelloAckPayload struct {
	PlayerID string `json:"playerId"`
}

type QueueJoinPayload struct {
	QueueType    string `json:"queueType,omitempty"`
	TournamentID uint   `json:"tournamentId,omitempty"`
}

type GameStartPayload struct {
	MatchID        string `json:"matchId"`
	OpponentID     string `json:"opponentId"`
	OpponentName   string `json:"opponentName"`
	OpponentAvatar string `json:"opponentAvatar"`
	OpponentRating int    `json:"opponentRating"`
	RoundDurationS int    `json:"roundDurationSec"`
	Role           string `json:"role"`
	StartedAt      int64  `json:"startedAt"`
	TargetCode     string `json:"targetCode"`
	PollutedCode   string `json:"pollutedCode"`
}

type BotGameStartPayload struct {
	MatchID        string `json:"matchId"`
	BotID          string `json:"botId"`
	BotName        string `json:"botName"`
	BotAvatar      string `json:"botAvatar"`
	BotRating      int    `json:"botRating"`
	RoundDurationS int    `json:"roundDurationSec"`
	Role           string `json:"role"`
	StartedAt      int64  `json:"startedAt"`
	TargetCode     string `json:"targetCode"`
	PollutedCode   string `json:"pollutedCode"`
}

type BufferUpdatePayload struct {
	Content *string      `json:"content,omitempty"`
	Delta   *BufferDelta `json:"delta,omitempty"`
	Cursor  int          `json:"cursor,omitempty"`
	Replay  *ReplayMeta  `json:"replay,omitempty"`
}

type BufferDelta struct {
	Ops []BufferDeltaOp `json:"ops"`
}

type BufferDeltaOp struct {
	Type string `json:"type"`
	Pos  int    `json:"pos,omitempty"`
	Text string `json:"text,omitempty"`
	From int    `json:"from,omitempty"`
	To   int    `json:"to,omitempty"`
}

type KeystrokeEntry struct {
	Ops             json.RawMessage `json:"ops"`
	Timestamp       int64           `json:"timestamp"`
	KeyRaw          string          `json:"keyRaw,omitempty"`
	KeyDisplay      string          `json:"keyDisplay,omitempty"`
	ModeBefore      string          `json:"modeBefore,omitempty"`
	ModeAfter       string          `json:"modeAfter,omitempty"`
	CursorOffset    int             `json:"cursorOffset,omitempty"`
	CursorLine      int             `json:"cursorLine,omitempty"`
	CursorCol       int             `json:"cursorCol,omitempty"`
	BufferLineCount int             `json:"bufferLineCount,omitempty"`
	ViewportTopLine int             `json:"viewportTopLine,omitempty"`
	ViewportHeight  int             `json:"viewportHeight,omitempty"`
}

type ReplayMeta struct {
	KeyRaw          string `json:"keyRaw,omitempty"`
	KeyDisplay      string `json:"keyDisplay,omitempty"`
	ModeBefore      string `json:"modeBefore,omitempty"`
	ModeAfter       string `json:"modeAfter,omitempty"`
	CursorOffset    int    `json:"cursorOffset,omitempty"`
	CursorLine      int    `json:"cursorLine,omitempty"`
	CursorCol       int    `json:"cursorCol,omitempty"`
	BufferLineCount int    `json:"bufferLineCount,omitempty"`
	ViewportTopLine int    `json:"viewportTopLine,omitempty"`
	ViewportHeight  int    `json:"viewportHeight,omitempty"`
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
	ResultType      string  `json:"resultType"`
	Reason          string  `json:"reason"`
	FinishedAt      int64   `json:"finishedAt"`
}

type SpectatorCountPayload struct {
	Count int `json:"count"`
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
	ID            string
	PlayerA       *Client
	PlayerB       *Client
	TournamentID  *uint
	BotID         string
	Bot           *Bot
	Status        MatchStatus
	TargetCode    string
	PollutedCode  string
	StartedAt     time.Time
	FinishedAt    *time.Time
	WinnerID      string
	LastSeqByID   map[string]int64
	BotMatch      *BotMatch
	PlayerABuffer string
	PlayerBBuffer string
	spectators    map[int]chan SpectatorEvent
	nextSpectator int
}

type SpectatorPlayerSnapshot struct {
	PlayerID    string `json:"playerId"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
}

type SpectatorSnapshotPayload struct {
	MatchID       string                  `json:"matchId"`
	StartedAt     int64                   `json:"startedAt"`
	TargetCode    string                  `json:"targetCode"`
	PollutedCode  string                  `json:"pollutedCode"`
	PlayerA       SpectatorPlayerSnapshot `json:"playerA"`
	PlayerB       SpectatorPlayerSnapshot `json:"playerB"`
	PlayerABuffer string                  `json:"playerABuffer"`
	PlayerBBuffer string                  `json:"playerBBuffer"`
}

type SpectatorDeltaPayload struct {
	PlayerID  string       `json:"playerId"`
	Seq       int64        `json:"seq"`
	Timestamp int64        `json:"timestamp"`
	Delta     *BufferDelta `json:"delta,omitempty"`
	Content   *string      `json:"content,omitempty"`
}

type SpectatorStatusPayload struct {
	State   string `json:"state"`
	Reason  string `json:"reason,omitempty"`
	MatchID string `json:"matchId,omitempty"`
}

type SpectatorHeartbeatPayload struct {
	TS int64 `json:"ts"`
}

type SpectatorEvent struct {
	Name string
	Data any
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
