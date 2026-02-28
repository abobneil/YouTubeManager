import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { prisma } from "@/lib/db";
import { getSessionOwnerId } from "@/lib/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const ownerId = await getSessionOwnerId();
  if (!ownerId) {
    redirect("/setup");
  }

  const owner = await prisma.ownerAccount.findUnique({
    where: { id: ownerId },
    select: { id: true },
  });
  if (!owner) {
    redirect("/setup");
  }

  return (
    <div className="app-shell">
      <div className="container">
        <AppNav />
        <main className="main-grid">{children}</main>
      </div>
    </div>
  );
}
