import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const defaults = [
    {
      key: "sync_interval_minutes",
      value: 360,
    },
    {
      key: "sync_soft_quota_limit",
      value: 2000,
    },
    {
      key: "sync_page_limit",
      value: 3,
    },
  ] as const;

  for (const item of defaults) {
    await prisma.appSetting.upsert({
      where: { key: item.key },
      update: { value: item.value },
      create: { key: item.key, value: item.value },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
