import { NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { env } from "@/lib/config";
import { prisma } from "@/lib/db";
import { toSyncRunDto } from "@/lib/serializers";

export async function GET(): Promise<NextResponse> {
  const ownerId = await requireOwnerSession();
  if (ownerId instanceof NextResponse) {
    return ownerId;
  }

  const [creatorCount, ruleCount, latestRun, recentEvents, intervalSetting] = await Promise.all([
    prisma.creator.count({ where: { active: true } }),
    prisma.topicRule.count({ where: { active: true } }),
    prisma.syncRun.findFirst({
      orderBy: { startedAt: "desc" },
    }),
    prisma.syncRunEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.appSetting.findUnique({ where: { key: "sync_interval_minutes" } }),
  ]);

  const intervalMinutes = Number(intervalSetting?.value ?? env.SYNC_INTERVAL_MINUTES);
  const nextScheduledRunAt = latestRun
    ? new Date(latestRun.startedAt.getTime() + intervalMinutes * 60_000)
    : new Date(Date.now() + intervalMinutes * 60_000);

  return NextResponse.json({
    creatorCount,
    ruleCount,
    latestRun: latestRun ? toSyncRunDto(latestRun) : null,
    nextScheduledRunAt: nextScheduledRunAt.toISOString(),
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      runId: event.runId,
      level: event.level,
      code: event.code,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
    })),
  });
}
