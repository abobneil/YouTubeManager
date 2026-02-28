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
- Docker Compose (`web`, `worker`, `postgres`, `haproxy`)

## Quick Start

1. Copy `.env.example` to `.env` and fill required values.
2. Create a self-signed cert for HAProxy:

```bash
mkdir -p infra/haproxy/certs
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout infra/haproxy/certs/ytm.key \
  -out infra/haproxy/certs/ytm.crt \
  -days 365 \
  -subj "/CN=your-domain.example"
cat infra/haproxy/certs/ytm.key infra/haproxy/certs/ytm.crt > infra/haproxy/certs/ytm.pem
```

3. For domain-based OAuth, set:
- `NEXT_PUBLIC_APP_URL=https://your-domain.example`
- `GOOGLE_REDIRECT_URI=https://your-domain.example/api/auth/google/callback`

4. Run:

```bash
docker compose up --build
```

5. Open `https://your-domain.example/setup`.
6. Sign in with Google, add creators/rules, then run manual sync from dashboard.

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
