# Postgres Backup and Restore

## Backup

```bash
docker exec ytm_postgres pg_dump -U yt_manager -d yt_manager > ytm_backup.sql
```

## Restore

1. Stop app/worker to avoid writes.
2. Restore dump:

```bash
cat ytm_backup.sql | docker exec -i ytm_postgres psql -U yt_manager -d yt_manager
```

3. Restart services:

```bash
docker compose up -d web worker
```

## Volume-level backup

Snapshot the named Docker volume `postgres_data` with your host backup tooling for point-in-time copies.
