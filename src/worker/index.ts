import cron from "node-cron";
import { SyncTrigger } from "@prisma/client";
import { env } from "@/lib/config";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { claimNextManualRequest, runSync } from "@/lib/sync/engine";

function cronExpressionForMinutes(intervalMinutes: number): string {
  if (intervalMinutes < 60) {
    return `*/${intervalMinutes} * * * *`;
  }
  if (intervalMinutes % 60 === 0) {
    const hours = intervalMinutes / 60;
    if (hours <= 24) {
      return `0 */${hours} * * *`;
    }
  }
  logger.warn(
    { intervalMinutes },
    "Unsupported interval for exact cron schedule. Falling back to hourly cadence.",
  );
  return "0 * * * *";
}

async function processManualRequests(): Promise<void> {
  while (true) {
    const request = await claimNextManualRequest();
    if (!request) {
      break;
    }
    logger.info({ requestId: request.id }, "Processing manual sync request");
    try {
      await runSync(SyncTrigger.MANUAL, request.id);
    } catch (error) {
      logger.error({ error, requestId: request.id }, "Manual sync failed");
    }
  }
}

async function runScheduledSync(): Promise<void> {
  logger.info("Starting scheduled sync run");
  try {
    await runSync(SyncTrigger.SCHEDULED);
  } catch (error) {
    logger.error({ error }, "Scheduled sync failed");
  }
}

async function main(): Promise<void> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "sync_interval_minutes" },
    select: { value: true },
  });
  const intervalMinutes = Number(setting?.value ?? env.SYNC_INTERVAL_MINUTES);
  const cronExpr = cronExpressionForMinutes(intervalMinutes);
  logger.info(
    {
      cronExpr,
      intervalMinutes,
      pollSeconds: env.WORKER_POLL_SECONDS,
    },
    "Worker started",
  );

  cron.schedule(cronExpr, runScheduledSync, { timezone: "UTC" });
  setInterval(() => {
    processManualRequests().catch((error) => {
      logger.error({ error }, "Manual request polling failed");
    });
  }, env.WORKER_POLL_SECONDS * 1000);

  await processManualRequests();
}

main().catch((error) => {
  logger.fatal({ error }, "Worker boot failed");
  process.exit(1);
});
