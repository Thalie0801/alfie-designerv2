import CheckoutButton from "@/components/billing/CheckoutButton";
import { requireUser } from "@/lib/auth/server";
import { PLAN_CONFIG, type BillingPlan } from "@/lib/billing/quotas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLAN_DETAILS: Array<{
  id: BillingPlan;
  title: string;
  price: string;
  description: string;
}> = [
  {
    id: "starter",
    title: "Starter",
    price: "49€ / mois",
    description: "Idéal pour lancer vos premières campagnes avec Alfie.",
  },
  {
    id: "pro",
    title: "Pro",
    price: "149€ / mois",
    description: "Pensé pour les équipes marketing qui produisent chaque semaine.",
  },
  {
    id: "studio",
    title: "Studio",
    price: "299€ / mois",
    description: "Tout le potentiel d'Alfie pour les studios et agences créatives.",
  },
];

interface BillingPageProps {
  searchParams?: {
    canceled?: string;
    welcome?: string;
  };
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  await requireUser("/billing");

  const canceled = searchParams?.canceled === "1";
  const welcome = searchParams?.welcome === "1";

  return (
    <div className="container">
      <div className="card billing-hero">
        <h1>Choisissez votre plan</h1>
        <p>Chaque offre inclut l&apos;accès au générateur Alfie, au dashboard et à la bibliothèque de templates.</p>
        {welcome && <p className="status success">Merci pour votre confiance ! Votre abonnement est activé.</p>}
        {canceled && <p className="status warning">Le paiement a été interrompu. Vous pouvez relancer la souscription à tout moment.</p>}
      </div>

      <div className="plan-grid">
        {PLAN_DETAILS.map((plan) => {
          const quotas = PLAN_CONFIG[plan.id].quotas;
          return (
            <div key={plan.id} className="card plan-card">
              <div className="plan-header">
                <span className="plan-title">{plan.title}</span>
                <span className="plan-price">{plan.price}</span>
              </div>
              <p className="plan-description">{plan.description}</p>
              <ul className="plan-features">
                <li>{quotas.images} visuels par mois</li>
                <li>{quotas.reels} scripts vidéo courts</li>
                <li>{quotas.woofs} génératifs &quot;woofs&quot;</li>
              </ul>
              <CheckoutButton plan={plan.id} label="Passer sur ce plan" />
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .billing-hero {
          display: grid;
          gap: 12px;
        }

        .status {
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 14px;
        }

        .status.success {
          background: rgba(30, 180, 90, 0.12);
          color: #1ea45c;
        }

        .status.warning {
          background: rgba(255, 196, 0, 0.12);
          color: #b98200;
        }

        .plan-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }

        .plan-card {
          display: grid;
          gap: 16px;
        }

        .plan-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }

        .plan-title {
          font-size: 20px;
          font-weight: 600;
        }

        .plan-price {
          font-size: 18px;
          font-weight: 500;
        }

        .plan-description {
          margin: 0;
          color: rgba(16, 17, 20, 0.7);
        }

        :global([data-theme="dark"]) .plan-description {
          color: rgba(255, 255, 255, 0.7);
        }

        .plan-features {
          margin: 0;
          padding-left: 20px;
          display: grid;
          gap: 8px;
        }

        .plan-features li {
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
