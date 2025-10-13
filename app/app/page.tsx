export const dynamic = "force-dynamic";
export const revalidate = 0;

// Si l'alias "@/components/..." échoue, remplace par un chemin RELATIF vers HomePageClient
import HomePageClient from "@/components/HomePageClient";

export default function Page() {
  return (
    <main className="container">
      <HomePageClient />
    </main>
  );
}
