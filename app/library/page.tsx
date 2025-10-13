import { requireUserWithProfile } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LibraryPage() {
  await requireUserWithProfile("/library");

  return (
    <div className="container">
      <div className="card section-card">
        <h1>Bibliothèque</h1>
        <p>Centralisez vos concepts, variantes et exports. Cette section affichera vos créations récentes dès la connexion de vos données.</p>
      </div>

      <style jsx>{`
        .section-card {
          display: grid;
          gap: 12px;
        }
      `}</style>
    </div>
  );
}
