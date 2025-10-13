import { requireUserWithProfile } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TemplatesPage() {
  await requireUserWithProfile("/templates");

  return (
    <div className="container">
      <div className="card section-card">
        <h1>Templates Canva</h1>
        <p>Retrouvez prochainement vos collections de templates synchronisées avec votre workspace Canva.</p>
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
