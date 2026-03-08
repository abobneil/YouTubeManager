# API Contract (v1)

All endpoints return JSON. Except health/setup/auth redirects, all authenticated endpoints require a valid owner session cookie.

## Auth

- `GET /api/auth/google/start`: Starts Google OAuth flow and redirects to Google.
- `GET /api/auth/google/callback`: Completes OAuth flow, only allows first-time enrollment for an allowlisted verified email, then only allows the bound Google subject on later logins.
- `POST /api/auth/logout`: Clears owner session. Cross-origin requests are rejected with `403 ORIGIN_NOT_ALLOWED`.

## Owner

- `GET /api/me`: Returns owner profile metadata.

## Creators

- `GET /api/creators`: Returns creator list.
- `POST /api/creators`
  - Body:
    - `input: string` (channel URL, `@handle`, or `UC...` ID)
    - `displayName?: string`
    - `active?: boolean`
  - Cross-origin requests are rejected with `403 ORIGIN_NOT_ALLOWED`.
- `PATCH /api/creators/:id`
  - Body: partial `{ displayName?: string, active?: boolean }`
  - Cross-origin requests are rejected with `403 ORIGIN_NOT_ALLOWED`.
- `DELETE /api/creators/:id`
  - Cross-origin requests are rejected with `403 ORIGIN_NOT_ALLOWED`.
- `GET /api/creators/subscriptions`
  - Returns paginated pull of your current YouTube subscriptions (deduped and annotated with `alreadyAdded`).
- `POST /api/creators/import`
  - Body:
    - `channelIds: string[]` (`UC...` IDs, max 200 per request)
    - `active?: boolean` (default `true`)
  - Imports selected subscribed channels as creators and returns `imported`, `skipped`, and `failed` entries.
  - Cross-origin requests are rejected with `403 ORIGIN_NOT_ALLOWED`.

## Topic Rules

- `GET /api/rules`: Returns rules with creator scope IDs.
- `POST /api/rules`
  - Body:
    - `name: string`
    - `includeKeywords: string[]`
    - `excludeKeywords?: string[]`
    - `matchFields?: TITLE | DESCRIPTION | BOTH`
    - `caseSensitive?: boolean`
    - `orderMode?: NEWEST | OLDEST`
    - `privacyStatus?: PRIVATE | UNLISTED`
    - `active?: boolean`
    - `creatorScopeIds?: string[]`
  - Cross-origin requests are rejected with `403 ORIGIN_NOT_ALLOWED`.
- `PATCH /api/rules/:id`: Partial update with same fields as create.
- Cross-origin requests are rejected with `403 ORIGIN_NOT_ALLOWED`.
- `DELETE /api/rules/:id`
- Cross-origin requests are rejected with `403 ORIGIN_NOT_ALLOWED`.

## Sync

- `POST /api/sync/manual`: Enqueue a manual sync request. Cross-origin requests are rejected with `403 ORIGIN_NOT_ALLOWED`.
- `GET /api/sync/runs`: Returns latest sync runs.
- `GET /api/sync/runs/:id`: Returns one sync run with ordered event list.

## Dashboard

- `GET /api/dashboard`
  - Returns: creator/rule counts, latest run, next scheduled run timestamp, recent run events.

## Health

- `GET /api/health`
  - Returns app and DB health status.
