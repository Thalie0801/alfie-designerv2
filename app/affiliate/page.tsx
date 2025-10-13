import { requireUserWithProfile } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AffiliatePage() {
  await requireUserWithProfile("/affiliate");

  return (
    <div className="container">
      <div className="card section-card">
        <h1>Programme d&apos;affiliation</h1>
        <p>Suivez ici vos référencements, commissions et paiements. Renseignez votre code de parrainage et invitez vos clients pour débloquer des bonus.</p>
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
