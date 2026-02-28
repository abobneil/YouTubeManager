# Local Operations

## 1) Prerequisites

- Docker + Docker Compose
- Google Cloud project with OAuth client for web app
- YouTube Data API v3 enabled

## 2) Configure environment

1. Copy `.env.example` to `.env`.
2. Set:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` (must match OAuth client, usually `http://localhost:3000/api/auth/google/callback`)
   - `SESSION_SECRET` (>= 32 chars)
   - `ENCRYPTION_KEY_HEX` (64 hex chars)

## 3) Start stack

```bash
docker compose up --build
```

Services:
- App UI/API: `http://localhost:3000`
- Postgres: `localhost:5432`

## 4) First-use flow

1. Open `/setup`.
2. Sign in with Google.
3. Add creators on `/creators`.
4. Add keyword rules on `/rules`.
5. Trigger manual sync on `/dashboard`.

## 5) Local Node (non-docker) commands

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Worker in a separate shell:

```bash
npm run worker
```
