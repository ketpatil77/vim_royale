![Demo](./assets/vim_royale_hero.png)
<div align="center">
    <a href="https://peerlist.io/jitesh117/project/vim-royale" target="_blank" rel="noreferrer">
        <img
            src="https://peerlist.io/api/v1/projects/embed/PRJHKKD9N7D9OAEPGIDJE68EPMLNAN?showUpvote=true&theme=light"
            alt="Vim Royale"
            style="width: auto; height: 72px;"
        />
    </a>
</div>


## About

Vim Royale is a pvp vim based multiplayer game. Users can play 1v1 matches against each other and compete for a spot on the leaderboard. The game uses AI to generate random code snippets for players to edit and compete on. Users can sign in with Google to save their progress and compete on the leaderboard. 

## Features
- 1v1 matches with real-time updates
- Rating system based on Elo
- Spectator mode for matches
- Create and join custom lobbies with your friends
- Match replay to analyse your movies
- Built-in VimTutor
- Leaderboard to compete for a spot
- Code snippets for players to edit and compete on

## Tech Stack

- Frontend: React, TypeScript, Vite, CodeMirror
- Backend: Go, Gin, WebSockets, GORM
- Database: PostgreSQL
- Auth: Google/GitHub OAuth

## Want to Contribute?

Refer to [CONTRIBUTING.md](./CONTRIBUTING.md)

## Security

Refer to [SECURITY.md](./SECURITY.md)

## Running Locally

### Prerequisites

- Docker Desktop or Docker Engine with Compose support
- Node.js and npm for the frontend dev server
- Google or GitHub OAuth credentials if you want to test sign-in flows

### Backend

Start PostgreSQL and the Go API from the backend directory:

```bash
cd backend && docker compose -f docker-compose.dev.yml up --build   
```

The development compose file publishes the backend on `http://localhost:8080`.

### Frontend

In a second terminal, start the Vite app:

```bash
cd frontend && npm install && npm run dev
```

By default the frontend runs on Vite's local URL, typically `http://localhost:5173`.

### Environment variables

The backend reads these OAuth-related variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URL`

If you only want to work on gameplay or UI, you can skip OAuth and focus on the
local backend plus frontend stack first.

### Troubleshooting

- If port `8080` is already in use, stop the conflicting process before starting the backend compose stack.
- If the frontend cannot reach the API, check your `VITE_API_URL`, `VITE_WS_URL`, and `VITE_WS_PUBLIC_URL` values in the frontend environment.
- If sign-in fails locally, confirm your OAuth redirect URLs match the local host and port you are using.

## Support

If you wish to suport further development of Vim Royale, you can donate via [GitHub Sponsors](https://github.com/sponsors/Jitesh117), [BuyMeACoffee](https://www.buymeacoffee.com/jitesh117) or [PayPal](https://www.paypal.com/paypalme/jitesh1177)

## Credits

- [Primeagen](https://github.com/ThePrimeagen) for the idea of the game and the name via his streams.
