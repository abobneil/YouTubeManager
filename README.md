# YouTube Smart Playlist Manager

Self-hosted TypeScript web app for a single owner account that:

- Connects to Google OAuth
- Lets you define creators + keyword rules
- Creates/manages YouTube playlists per rule
- Runs sync every 6 hours in a background worker
- Supports manual sync queueing from the dashboard
- Adds owner binding, proxy authentication, and same-origin mutation protection

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL + Prisma ORM
- Node worker with `node-cron`
- Docker Compose (`web`, `worker`, `postgres`, `haproxy`)

## Quick Start

1. Copy `.env.example` to `.env` and fill required values.
2. Set the hardened deployment controls:
   - `OWNER_GOOGLE_EMAIL_ALLOWLIST`
   - `EDGE_SHARED_SECRET`
   - `TRUSTED_CLIENT_CIDRS`
   - `HAPROXY_BASIC_AUTH_USER`
   - `HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT`
   - `ALLOWED_MUTATION_ORIGINS`
3. Generate a bcrypt password hash for HAProxy basic auth:

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbBC 12 ytm-admin 'change-me' | sed -e 's/^[^:]*://'
```

When storing the bcrypt hash in `.env` for Docker Compose, escape each `$` as `$$`.

4. On first `docker compose up`, the `cert-init` service generates a self-signed TLS cert automatically if `infra/haproxy/certs/ytm.pem` does not exist.

5. For domain-based OAuth, set:
- `NEXT_PUBLIC_APP_URL=https://your-domain.example`
- `GOOGLE_REDIRECT_URI=https://your-domain.example/api/auth/google/callback`
- `ALLOWED_MUTATION_ORIGINS=https://your-domain.example`

6. Run:

```bash
docker compose up --build
```

7. Open `https://your-domain.example/setup`.
8. Sign in with the allowlisted Google account, add creators/rules, then run manual sync from dashboard.

## Scripts

- `npm run dev` - Next.js dev server
- `npm run worker` - background worker process
- `npm run validate:runtime` - validate hardened production env settings
- `npm run prisma:migrate` - local migration creation/apply
- `npm run prisma:deploy` - apply committed migrations
- `npm run prisma:seed` - seed app settings
- `npm run test` - run unit tests
- `npm run lint` - run ESLint

## Docs

- API contract: [docs/api.md](docs/api.md)
- Local ops: [docs/local-ops.md](docs/local-ops.md)
- Backup/restore: [docs/backup-restore.md](docs/backup-restore.md)
