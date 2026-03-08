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
   - `GOOGLE_REDIRECT_URI` (must match OAuth client)
   - `SESSION_SECRET` (>= 32 chars)
   - `ENCRYPTION_KEY_HEX` (64 hex chars)
   - `OWNER_GOOGLE_EMAIL_ALLOWLIST`
   - `EDGE_SHARED_SECRET` (>= 32 chars)
   - `TRUSTED_CLIENT_CIDRS`
   - `HAPROXY_BASIC_AUTH_USER`
   - `HAPROXY_BASIC_AUTH_PASSWORD_BCRYPT`
   - `ALLOWED_MUTATION_ORIGINS`
3. For HTTPS with a domain, set:
   - `NEXT_PUBLIC_APP_URL=https://your-domain.example`
   - `GOOGLE_REDIRECT_URI=https://your-domain.example/api/auth/google/callback`
   - `ALLOWED_MUTATION_ORIGINS=https://your-domain.example`

Generate the HAProxy basic-auth bcrypt hash with:

```bash
docker run --rm httpd:2.4-alpine htpasswd -nbBC 12 ytm-admin 'change-me' | sed -e 's/^[^:]*://'
```

When placing the bcrypt hash in `.env`, escape each `$` as `$$` so Docker Compose preserves it correctly.

## 3) Start stack

On the first `docker compose up`, the `cert-init` service creates `infra/haproxy/certs/ytm.pem` automatically if it is missing. The certificate common name is derived from `NEXT_PUBLIC_APP_URL`.

```bash
docker compose up --build
```

Services:
- App UI/API via HAProxy: `https://your-domain.example` (port 443)
- Postgres: `localhost:5432`

## 4) First-use flow

1. Open `/setup`.
2. Sign in with the allowlisted Google account.
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

The local Node flow is for development only. The hardened deployment path is Docker Compose behind HAProxy.
