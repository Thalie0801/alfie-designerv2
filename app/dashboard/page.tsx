import { requireUserWithProfile } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
  const { profile } = await requireUserWithProfile("/dashboard");

  return (
    <div className="container">
      <div className="card dashboard-card">
        <h1>Dashboard</h1>
        <p>Bienvenue dans votre espace client. Votre plan actuel : <strong>{profile?.plan ?? "non défini"}</strong>.</p>
        <p>
          Accédez au générateur, suivez vos quotas et retrouvez vos briefs validés. Des widgets de performance viendront s&apos;afficher ici.
        </p>
      </div>

      <style jsx>{`
        .dashboard-card {
          display: grid;
          gap: 12px;
        }
      `}</style>
    </div>
  );
}
