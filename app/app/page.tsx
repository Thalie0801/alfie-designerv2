import HomePageClient from "@/components/HomePageClient";
import { requireUserWithProfile } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppPage() {
  await requireUserWithProfile("/app");

  return <HomePageClient />;
}
