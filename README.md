# YouTube Smart Playlist Manager

Self-hosted TypeScript web app for a single owner account that:

- Connects to Google OAuth
- Lets you define creators + keyword rules
- Creates/manages YouTube playlists per rule
- Runs sync every 6 hours in a background worker
- Supports manual sync queueing from the dashboard

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma ORM
- Node worker with `node-cron`
- Docker Compose (`web`, `worker`, `postgres`)

## Quick Start

1. Copy `.env.example` to `.env` and fill required values.
2. Run:

```bash
docker compose up --build
```

3. Open `http://localhost:3000/setup`.
4. Sign in with Google, add creators/rules, then run manual sync from dashboard.

## Scripts

- `npm run dev` - Next.js dev server
- `npm run worker` - background worker process
- `npm run prisma:migrate` - local migration creation/apply
- `npm run prisma:deploy` - apply committed migrations
- `npm run prisma:seed` - seed app settings
- `npm run test` - run unit tests
- `npm run lint` - run ESLint

## Docs

- API contract: [docs/api.md](docs/api.md)
- Local ops: [docs/local-ops.md](docs/local-ops.md)
- Backup/restore: [docs/backup-restore.md](docs/backup-restore.md)
