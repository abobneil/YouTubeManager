import { redirect } from "next/navigation";
import { getSessionOwnerId } from "@/lib/session";

export default async function Home(): Promise<never> {
  const ownerId = await getSessionOwnerId();
  if (ownerId) {
    redirect("/dashboard");
  }
  redirect("/setup");
}
