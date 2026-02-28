import { Pool, PoolClient } from "pg";
import { env } from "@/lib/config";

const LOCK_ID = 7_240_991;
const pool = new Pool({ connectionString: env.DATABASE_URL });

export type LockHandle = {
  client: PoolClient;
  acquired: boolean;
};

export async function acquireSyncLock(): Promise<LockHandle> {
  const client = await pool.connect();
  const result = await client.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_lock($1) AS acquired",
    [LOCK_ID],
  );
  const acquired = Boolean(result.rows[0]?.acquired);
  return { client, acquired };
}

export async function releaseSyncLock(handle: LockHandle): Promise<void> {
  try {
    if (handle.acquired) {
      await handle.client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
    }
  } finally {
    handle.client.release();
  }
}
