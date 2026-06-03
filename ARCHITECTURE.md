# Vim Royale Architecture

This document explains how Vim Royale is put together, why the major pieces are shaped the way they are, and where contributors should look when changing core behavior.

Vim Royale is a browser-based competitive Vim game. Players edit a polluted code sample back into the target code while the app streams edits between opponents in real time. The project has two main applications:

- `frontend/`: React, TypeScript, Vite, CodeMirror, and the browser-facing game UI.
- `backend/`: Go, Gin, Gorilla WebSocket, GORM, PostgreSQL, OAuth, and realtime match orchestration.

At a high level:

```text
Browser
  |
  | HTTP: auth, guest sessions, scores, tournaments, profiles, replays
  | WebSocket: matchmaking, match events, editor deltas, game results
  v
Go backend
  |
  | durable records
  v
PostgreSQL
```

The backend is intentionally split between durable state and live state:

- Durable state lives in PostgreSQL: users, ratings, matches, match keystrokes, timed score runs, guest sessions, tournaments, participants, and bracket matches.
- Live state lives in one in-memory hub process: connected websocket clients, active matches, ranked queues, tournament queues, spectator subscriptions, and bot replay execution.

That split keeps realtime gameplay fast and simple while still persisting outcomes and history.

## Goals

The current architecture optimizes for:

- A playable realtime browser experience with low coordination overhead.
- A small backend that can be understood and modified without a large framework.
- Clear separation between HTTP workflows and websocket gameplay.
- Durable persistence for identity, tournament state, ratings, score history, and replay history.
- Support for both authenticated users and guests.
- A contributor-friendly codebase where most feature work maps to a small number of files.

The architecture does not currently optimize for:

- Horizontal scaling of active matches across multiple backend instances.
- Full event sourcing of every live gameplay event.
- Server-authoritative validation of every editing operation.
- Large-scale matchmaking across distributed queues.

Those are valid future directions, but the current design keeps the first public version approachable.

## Repository Layout

```text
backend/
  auth/          OAuth callbacks, auth cookies, OAuth state helpers
  config/        environment loading and trusted proxy configuration
  data/bots/     bot definitions and replay data
  db/            GORM database access helpers and transactional workflows
  handlers/      Gin HTTP and websocket route handlers
  middleware/    auth, CSRF, and rate limiting middleware
  models/        GORM models and shared backend domain structs
  services/      realtime hub, matchmaking, bots, spectators, websocket protocol
  utils/         sample code generation, code pollution, Elo calculation

frontend/
  public/        static assets, fonts, icons, audio
  src/
    components/ shared UI components
    contexts/   auth, guest, CRT, keybinding, and timed-game context
    hooks/      reusable frontend hooks
    pages/      route-level screens
    pages/typingChallenge/
                match editor state, websocket hook, message parsing, game helpers
    types/      shared TypeScript domain types
    utils/      client API helpers and replay/timed-score utilities
```

## Backend Overview

The backend is a Gin server initialized in `backend/main.go`.

Startup flow:

1. Load environment configuration from `.env` or process env.
2. Initialize bot definitions from `backend/data/bots`.
3. Create a single realtime `Hub`.
4. Start the hub loop in a goroutine.
5. Register HTTP, websocket, auth, score, tournament, replay, and health routes.
6. Start listening on `ADDR`, defaulting to `:8080`.

The backend exposes two kinds of API surfaces:

- HTTP routes for durable workflows.
- WebSocket routes for live gameplay.

### HTTP Responsibilities

HTTP handlers live in `backend/handlers`.

Important route groups:

- `/healthz`: health check.
- `/auth/*`: Google/GitHub OAuth, current user, profile updates, keybinding settings, logout.
- `/guest/session`: guest identity bootstrap.
- `/leaderboard`: public leaderboard.
- `/users/:username`: profile and match history.
- `/matches/:matchId/replay`: persisted replay lookup.
- `/matches/:matchId/spectate`: live spectator stream.
- `/timed-scores/*`: timed score run creation, completion, saving, and best scores.
- `/tournaments/*`: tournament creation, joining, locking, seeding, starting, reporting, leaderboard, and event stream.

HTTP routes are used for actions that either need persistence, browser navigation, or request/response semantics. Websockets are reserved for realtime match state.

### WebSocket Responsibilities

Websocket route handlers live in `backend/handlers/websocket.go`; the live behavior lives mostly in `backend/services`.

Routes:

- `/ws`: authenticated websocket route. It runs auth middleware first and can force the player identity from the auth cookie.
- `/ws/public`: public websocket route for guest play and guest tournament sessions.

Every websocket client must send `HELLO` as the first message. This is a deliberate design decision. It lets the server attach identity before accepting queue joins or gameplay messages, and it gives one common validation path for authenticated users, guests, and tournament guests.

After `HELLO`, clients can send:

- `QUEUE_JOIN`: join ranked, bot, or tournament matchmaking.
- `BUFFER_UPDATE`: send editor content or compact edit deltas.
- `PLAYER_FINISHED`: declare that the player completed the challenge.

The server sends:

- `HELLO_ACK`
- `GAME_START`
- `BOT_GAME_START`
- `BUFFER_UPDATE`
- `GAME_OVER`
- `SPECTATOR_COUNT`
- `ERROR`

The protocol is envelope-based:

```json
{
  "type": "BUFFER_UPDATE",
  "matchId": "...",
  "playerId": "...",
  "seq": 12,
  "timestamp": 1710000000,
  "payload": {}
}
```

The envelope keeps routing metadata separate from payload shape. That makes it easier to add new payloads without changing the transport contract.

## The Realtime Hub

The core live-game component is `Hub` in `backend/services/hub.go`.

The hub owns:

- connected clients
- clients by player ID
- active matches
- ranked waiting buckets
- tournament queues
- incoming websocket messages
- client registration and unregistration

The hub uses channels for lifecycle and message entry points:

```text
Client websocket goroutines
  |
  | Register / Unregister / incoming messages
  v
Hub.Run()
  |
  | mutates active in-memory state
  v
matches, queues, clients, spectators
```

This single-hub design keeps live match coordination understandable. Most match mutations happen under the hub lock, so the code avoids a complicated distributed ownership model.

### Design Decision: In-Memory Active Matches

Active matches are not stored as fully live database rows. The database stores completed matches and tournament bracket state, while the hub stores the current websocket-level match state.

Benefits:

- Low latency for editor delta relay.
- No database write on every keystroke.
- Simpler websocket state management.
- Easy cleanup when clients disconnect.

Tradeoffs:

- Active matches are lost if the backend process restarts.
- A single backend instance owns all active matches.
- Horizontal scaling would require sticky sessions, shared queue/match state, or a message broker.

This is a reasonable early-stage tradeoff for a realtime game with a compact backend.

### Client Lifecycle

Each websocket client is represented by `Client` in `backend/services/client.go`.

Client goroutines:

- `ReadPump`: reads raw websocket messages, parses envelopes, validates the initial `HELLO`, and forwards messages into the hub.
- `WritePump`: serializes outgoing messages from the client's send channel and sends ping frames.

The server tracks heartbeat freshness with websocket pongs. Queue matching checks heartbeat freshness before pairing players. This reduces the chance of matching against a stale connection.

### Duplicate Identity Handling

The hub tracks `clientsByID` to prevent the same player identity from being connected twice. This matters because a player could otherwise queue multiple connections under one identity or create confusing match ownership.

The frontend has a small recovery path for duplicate player errors during matchmaking, but the backend remains the source of truth.

## Matchmaking

Matchmaking lives in `backend/services/queue.go`.

There are two queue types:

- Ranked queue.
- Tournament queue.

### Ranked Queue

Ranked matchmaking uses rating buckets. The hub has `41` buckets, and each player is placed into a bucket from the rating value held on the `Client`. The current implementation clamps out-of-range rating values into bucket `0`, so this area is worth revisiting if ratings are meant to be treated as raw Elo values rather than normalized bands.

When a player joins:

1. The hub validates that the client is active and identified.
2. The hub rejects clients already in a match or already in queue.
3. The player is placed into their rating bucket.
4. The bucket attempts to match the first two eligible players.

A background expansion loop runs every second. If players wait long enough, the hub gradually searches neighboring buckets. This avoids leaving players stuck forever when no exact-bucket opponent is available.

Design decision:

- Start with simple bucket-based matchmaking rather than a global priority queue or external service.
- Keep matching deterministic and local to the hub.
- Expand search over time to balance fairness and wait time.

### Tournament Queue

Tournament queues are more constrained. Players are not matched with arbitrary opponents. Instead:

1. The backend checks tournament queue eligibility from the database.
2. The participant must have an expected opponent.
3. Both participants must be queued for the same tournament.
4. Each participant must expect the other.
5. Only then does the hub start the match.

This design keeps bracket authority in the database while still using the hub for live match startup.

## Match Flow

Typical multiplayer flow:

```text
Browser connects to /ws or /ws/public
  -> sends HELLO
Backend validates identity
  -> sends HELLO_ACK
Browser sends QUEUE_JOIN
Hub pairs two clients
  -> creates in-memory Match
  -> chooses target code
  -> creates polluted code
  -> sends GAME_START to both players
Players edit locally in CodeMirror
  -> browser sends BUFFER_UPDATE deltas
Hub validates match ownership and sequence
  -> relays delta to opponent
  -> broadcasts spectator delta
Player finishes
  -> browser sends PLAYER_FINISHED
Hub finalizes match
  -> persists result if applicable
  -> saves replay keystrokes if provided
  -> sends GAME_OVER
  -> cleans up active match
```

### Code Challenge Generation

The backend chooses a target code sample through `backend/utils/sample_code.go` and then creates a polluted version through `backend/utils/challenge_code.go`.

The polluted code is what both players start with. The target code is the desired final state.

Design decision:

- Generate the challenge server-side so both players receive the same target and polluted code.
- Make the server the source of truth for the chosen challenge.
- Let the frontend focus on editing and display.

### Editor Deltas

The frontend uses CodeMirror change sets to produce compact deltas:

```json
{
  "ops": [
    { "type": "delete", "from": 10, "to": 12 },
    { "type": "insert", "pos": 10, "text": "const" }
  ]
}
```

The backend applies deltas to its in-memory copy of each player's buffer for live spectator snapshots, and forwards deltas to the opponent.

Design decision:

- Send deltas rather than full document content for normal gameplay.
- Keep a full-content fallback in the protocol for resync or compatibility.
- Track per-player sequence numbers and ignore duplicate/out-of-order updates.

### Match Completion

When the server receives `PLAYER_FINISHED`, it finalizes the match.

For authenticated-vs-authenticated ranked matches:

- A match row is created.
- Elo changes are calculated transactionally.
- User stats are updated.
- Optional keystroke replay data is saved.

For authenticated-vs-guest matches:

- The authenticated user's rating and stats may be updated.
- A mixed replay row can be created for the authenticated user.

For guest-vs-guest matches:

- The live result is sent, but durable ranked history is limited.

For tournament matches:

- The live match result is reported to the tournament database workflow.
- A tournament event is published.

### Draws and Timeouts

Each match has a fixed round duration plus a small countdown grace period. A timeout finalizes the match as a draw through the hub.

This keeps abandoned or unfinished games from staying in memory forever.

## Bots

Bot behavior lives in `backend/services/bot.go` and `backend/services/bot_match.go`.

The bot manager loads:

- built-in bot definitions
- optional JSON bot data from `backend/data/bots`
- scripted delta sequences where available
- fallback generated sequences when scripted data is absent

Bot matches use the same challenge model as multiplayer matches:

1. The player connects with a `botId`.
2. The hub validates the bot.
3. The hub creates an in-memory bot match.
4. The server sends `BOT_GAME_START`.
5. A goroutine replays bot deltas over time.
6. If the bot finishes first, the server sends `GAME_OVER`.
7. If the player finishes first, the hub resolves the result.

Design decision:

- Bots are server-driven so their timing cannot be spoofed by the client.
- Bot behavior is represented as timed deltas, which mirrors the normal player update protocol.
- Fallback bot generation keeps bot mode functional even without curated replay files.

## Spectating and Replay

Vim Royale has two related but distinct concepts:

- Live spectating.
- Persisted replay.

### Live Spectating

Live spectating uses the in-memory hub.

When a spectator subscribes to a live match:

1. The hub verifies the match is live and not a bot match.
2. The hub returns a snapshot of target code, polluted code, players, and current buffers.
3. The spectator receives future delta events.
4. Players receive spectator count updates.

Design decision:

- Live spectators subscribe to hub state instead of reading from the database.
- Slow spectator channels are dropped rather than blocking gameplay.

### Persisted Replay

Persisted replay is based on match keystroke data stored in PostgreSQL.

The frontend captures replay metadata such as:

- key pressed
- display key
- Vim mode before and after
- cursor offset
- cursor line and column
- buffer line count
- viewport information

On match completion, the frontend can send keystroke data with `PLAYER_FINISHED`. The backend stores it in `match_keystrokes`.

Design decision:

- The live game only needs deltas.
- Replay needs richer metadata, so it is captured separately and persisted only at match completion.
- This avoids writing every keystroke to the database during the match.

## Timed Score Runs

Timed score handling lives in `backend/handlers/score.go`, `backend/db/timed_score_run.go`, and `backend/db/timed_score.go`.

The timed score system uses a run-token lifecycle:

```text
start run
  -> server creates run token with TTL
player completes challenge
  -> client submits run token
server marks run complete
authenticated user saves
  -> server consumes completed run and creates score
```

This is an anti-tamper design. The client cannot simply submit an arbitrary score. It needs a server-created run token that belongs to the current authenticated user or guest session.

Design decision:

- Separate run start, completion, and save.
- Allow guests to complete timed runs.
- Allow a pending guest result to be saved after login.
- Consume runs when saving so the same run cannot be reused.

## Tournaments

Tournament behavior spans:

- `backend/handlers/tournament.go`
- `backend/db/tournament.go`
- `backend/models/tournament*.go`
- `backend/services/queue.go`
- `backend/services/tournament_events.go`
- `frontend/src/pages/Tournament`
- `frontend/src/utils/tournamentApi.ts`

The database owns tournament structure and permissions:

- tournament metadata
- invite token hashes
- participants
- seeds
- bracket matches
- match status
- host-only operations

The hub owns only the live websocket match once two eligible participants are ready to play.

Supported tournament formats in the model:

- single elimination
- double elimination
- group knockout

Tournament invite and guest session tokens are hashed before storage. This is an important security decision: leaked database rows should not directly expose usable invite/session tokens.

Tournament events use a lightweight in-memory event bus. Subscribers listen for tournament updates such as match completion. This is enough for one backend instance; distributed deployment would require replacing or backing this with shared pub/sub.

## Authentication and Identity

The backend supports Google and GitHub OAuth.

Auth flow:

1. Browser navigates to `/auth/google` or `/auth/github`.
2. Backend redirects to provider.
3. Provider redirects back to the callback route.
4. Backend finds or creates the user.
5. Backend signs a JWT.
6. Backend stores the JWT in an HTTP-only cookie.
7. Frontend calls `/auth/me` with credentials included.

The JWT contains:

- user ID
- provider
- provider ID
- email
- expiry

Player identity in websocket matches is normally represented as:

```text
provider:providerId
```

For guests, identity comes from guest sessions or tournament guest session tokens.

Design decision:

- Use HTTP-only cookies for browser auth rather than storing JWTs in local storage.
- Force authenticated websocket identity from middleware when using `/ws`.
- Support `/ws/public` separately for guest flows.

## Guest Sessions

Guest sessions are created through `/guest/session`.

The frontend stores the guest profile in `sessionStorage`, not permanent local storage. Guest sessions have a server-side TTL.

Guest sessions allow:

- guest matchmaking
- guest timed score runs
- guest tournament participation

Design decision:

- Let new users play before logging in.
- Keep guest credentials scoped and temporary.
- Avoid overloading OAuth identity for casual/local play.

## Security Design

Security-relevant pieces:

- JWT auth cookies are HTTP-only.
- Secure cookie mode is enabled when the request is secure.
- SameSite is `None` for secure requests and `Lax` otherwise.
- CSRF middleware checks `Origin` or `Referer` for mutating HTTP routes.
- WebSocket origin checks compare against `FRONTEND_URL`.
- Rate limiting is applied to health, public, auth, write, tournament, and websocket routes.
- OAuth state is issued and verified during login.
- Tournament invite/session tokens are hashed before database storage.
- Timed score runs use token ownership and consumption to reduce replay/tampering.
- `JWT_SECRET` is required at startup.
- Database DSNs are redacted in logs.

Design decision:

- Keep the security model simple and browser-native: cookies, origin checks, CSRF checks, and provider OAuth.
- Avoid exposing bearer tokens to frontend JavaScript for normal authenticated flows.

Important limitation:

- Realtime edit validation is not fully server-authoritative. The server accepts player finish events and optionally stores replay metadata. Future anti-cheat work should validate final buffers, completion hashes, timing, and replay consistency server-side.

## Frontend Overview

The frontend is a React/Vite app.

Route setup lives in `frontend/src/App.tsx`.

Major page areas:

- landing page
- login/auth callback
- play mode selection
- multiplayer/computer/tournament match page
- timed match page
- mini-games
- leaderboard
- profile
- match replay
- live spectate
- tournaments
- walkthrough
- Vim tutor docs
- keybinding settings

Global providers:

- `AuthProvider`: current authenticated user and login/logout/profile refresh.
- `GuestProvider`: guest identity creation and session storage.
- `KeybindingsProvider`: local and saved Vim keybinding settings.
- `CRTProvider`: display effect preferences.
- `TimedGameProvider`: timed-mode state.

### Match UI

The core match UI is in:

- `frontend/src/pages/Play/MatchPage.tsx`
- `frontend/src/pages/typingChallenge/useGameSocket.ts`
- `frontend/src/pages/typingChallenge/useEditors.ts`
- `frontend/src/pages/typingChallenge/editorState.ts`
- `frontend/src/pages/typingChallenge/createSocketCallbacks.ts`

The match page composes:

- the websocket hook
- editor setup
- game state transitions
- result modal
- sound effects
- spectator count
- replay capture

### Editor Design

CodeMirror is used for both player and opponent panes.

Player editor:

- editable
- Vim extension enabled
- keydown capture for replay metadata
- document-change listener for delta creation

Opponent editor:

- read-only
- receives deltas from the websocket
- mirrors opponent progress

Design decision:

- Keep editor behavior client-side for responsiveness.
- Send only the resulting document deltas to the backend.
- Use CodeMirror and `@replit/codemirror-vim` rather than implementing Vim behavior manually.

### Frontend Protocol Handling

`useGameSocket` owns the browser websocket lifecycle:

- open connection
- send `HELLO`
- send `QUEUE_JOIN` after `HELLO_ACK`
- send sequenced `BUFFER_UPDATE` messages
- send `PLAYER_FINISHED`
- parse server messages
- transition between matchmaking, playing, finished, and error states

Message parsing is split into `messageParser.ts`. This keeps websocket event handling less fragile and gives contributors one place to add payload validation for new message types.

## Data Model

Core persisted models:

- `User`: OAuth identity, profile, rating, stats, Vim keybindings.
- `Match`: persisted match history, players, guest metadata, target/polluted code, outcome, winner.
- `MatchKeystroke`: replay payloads for a match.
- `GuestSession`: temporary guest identity.
- `TimedScoreRun`: server-created timed-game run token and lifecycle.
- `TimedScore`: saved authenticated timed score.
- `Tournament`: tournament metadata, host, invite token hash, format, status.
- `TournamentParticipant`: authenticated or guest tournament participant.
- `TournamentMatch`: bracket/live tournament match metadata.

Database initialization uses GORM `AutoMigrate` in `backend/db/db.go`.

Design decision:

- Use GORM models for quick iteration and readable contributor onboarding.
- Keep database helpers in `backend/db` rather than embedding persistence logic directly in every handler.
- Use transactions for workflows that update multiple related rows, especially rating changes and tournament joins.

## Rating Model

Elo calculation lives in `backend/utils/elo.go`.

Authenticated ranked matches update both players transactionally. Mixed authenticated/guest matches update only the authenticated user. Bot matches currently do not modify bot ratings.

Design decision:

- Keep ratings tied to authenticated identities.
- Avoid storing permanent ranked state for anonymous guest-only matches.
- Use transactions and row locking for authenticated-vs-authenticated rating updates to reduce race conditions.

## Configuration

Backend configuration:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `JWT_SECRET`
- `FRONTEND_URL`
- `GOOGLE_REDIRECT_URL`

Frontend configuration:

- `VITE_API_URL`
- `VITE_WS_URL`

Design decision:

- Keep frontend URLs as build-time Vite environment variables.
- Keep backend secrets and deployment values in runtime environment variables.
- Require `JWT_SECRET` so the backend does not accidentally run with unsigned or weak auth.

## Deployment Shape

The included Docker Compose files are backend/PostgreSQL oriented.

The production-style compose file pulls:

- `postgres:16-alpine`
- `ghcr.io/jitesh117/vimroyale-backend:latest`

The local development compose file builds the backend from source.

The frontend is configured for Vercel through `frontend/vercel.json`.

Current deployment assumption:

```text
Vercel or static host
  -> serves React app
Backend host
  -> serves Gin HTTP API and WebSocket API
PostgreSQL
  -> persistent data
```

Because active matches are in memory, production deployments should route a player's websocket connection to the same backend instance for the duration of a match. A single backend instance naturally satisfies this. Multiple backend instances would need sticky sessions and shared queue/match coordination.

## Concurrency Model

Important concurrency patterns:

- One `Hub.Run()` loop receives registration, unregistration, and inbound messages.
- The hub lock protects clients, active matches, and queue state.
- Each websocket client has separate read and write pumps.
- Outgoing messages are buffered through per-client channels.
- Slow spectator channels are dropped.
- Some database writes are moved into goroutines so the hub loop does not block on slow persistence.
- Tournament event publishing uses a lightweight in-memory pub/sub bus.

Design decision:

- Prefer explicit locks and channels over a larger actor framework.
- Keep concurrency close to the websocket/hub boundary.
- Avoid database writes on every editor change.

## Known Tradeoffs and Future Improvements

### Tests

The repository currently has limited automated test coverage. There is an existing backend test around Vim keybindings, but the core realtime and tournament flows need more coverage.

High-value future tests:

- websocket protocol tests
- matchmaking tests
- match completion and rating transaction tests
- timed score run ownership tests
- tournament join/seed/start tests
- frontend message parser tests
- frontend editor delta tests
- one Playwright smoke test for starting a match

### Server-Authoritative Completion

The server currently trusts the client to indicate completion. A stronger design would:

- compare final buffer content against target code
- require or compute a final hash
- reject impossible completion times
- validate replay deltas against the final buffer
- store enough server-side timing data to audit suspicious results

### Horizontal Scaling

The current hub is process-local. To scale active gameplay across backend instances, the project would need one or more of:

- sticky websocket sessions
- shared matchmaking service
- Redis or another pub/sub system
- distributed match ownership
- external tournament event bus
- durable active-match recovery model

### Database Migrations

GORM `AutoMigrate` is convenient for early development. For a more mature public deployment, explicit migrations would give better control over schema changes.

### Observability

The backend currently uses logs but does not have structured metrics/tracing. Useful additions:

- active websocket count
- queued player count
- active match count
- match completion counters
- websocket error counters
- HTTP latency metrics
- tournament event metrics

## Contributor Guide: Where to Change Things

Common changes and where to start:

- Add a websocket message type: `backend/services/types.go`, `backend/services/hub.go`, `frontend/src/pages/typingChallenge/types.ts`, `messageParser.ts`, and `useGameSocket.ts`.
- Change matchmaking: `backend/services/queue.go`.
- Change match result behavior: `backend/services/match.go` and `backend/db/match.go`.
- Change bot behavior: `backend/services/bot.go`, `backend/services/bot_match.go`, and `backend/data/bots`.
- Change guest behavior: `backend/handlers/guest.go`, `backend/db/guest_session.go`, and `frontend/src/contexts/GuestContext.tsx`.
- Change auth behavior: `backend/auth`, `backend/middleware/auth.go`, and `frontend/src/contexts/AuthContext.tsx`.
- Change tournaments: `backend/handlers/tournament.go`, `backend/db/tournament.go`, tournament models, `frontend/src/pages/Tournament`, and `frontend/src/utils/tournamentApi.ts`.
- Change timed mode persistence: `backend/handlers/score.go`, timed score DB files, `frontend/src/utils/timedScores.ts`, and `frontend/src/contexts/TimedGameContext.tsx`.
- Change editor/Vim behavior: `frontend/src/pages/typingChallenge/editorState.ts`, `useEditors.ts`, and `frontend/src/keybindings/vimKeybindings.ts`.
- Change replay behavior: `frontend/src/utils/replayKeys.ts`, `frontend/src/utils/matchReplay.ts`, `backend/db/match.go`, and `backend/handlers/match.go`.

## Architectural Principles

When extending the project, prefer these principles:

- Keep live gameplay fast; avoid database writes in the per-keystroke path.
- Keep the backend authoritative for identity, matchmaking, challenge generation, and result persistence.
- Keep the frontend authoritative for immediate editor interaction and display state.
- Use the websocket protocol for realtime game state and HTTP for durable workflows.
- Preserve guest support unless a feature truly requires authentication.
- Store tokens as hashes when they need to be looked up later.
- Add server-side validation before trusting data that affects rankings, scores, or tournaments.
- Keep new abstractions small and local until a pattern repeats across multiple features.
