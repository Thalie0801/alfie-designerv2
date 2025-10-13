// Server Component

import { cookies } from "next/headers";
import Link from "next/link";
import HomePageClient from "@/components/HomePageClient";
import ThemeToggle from "@/components/ThemeToggle";
import RoleSwitcher from "@/components/RoleSwitcher";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REF_COOKIE = "ref";
const REF_MAX_AGE = 60 * 60 * 24 * 180; // 180 jours

type LandingPageProps = {
  searchParams?: { ref?: string };
};

const FEATURE_SECTIONS = [
  {
    title: "Briefing express",
    description:
      "Décrivez le contexte, les assets clés et les contraintes en quelques clics. Alfie structure et complète votre brief instantanément.",
  },
  {
    title: "Variations illimitées",
    description:
      "Générez des pistes créatives à partir de votre brief, ajustez le ton, le format ou la cible, puis itérez sans repartir de zéro.",
  },
  {
    title: "Collaboration simplifiée",
    description:
      "Partagez les briefs et concepts avec votre équipe ou vos clients pour valider plus vite et documenter chaque décision.",
  },
];

export default function Page({ searchParams }: LandingPageProps) {
  const refCode = searchParams?.ref;
  if (typeof refCode === "string" && refCode.trim()) {
    cookies().set(REF_COOKIE, refCode.trim(), { path: "/", maxAge: REF_MAX_AGE });
  }

  return (
    <main>
      <div className="container landing">
        <div className="landing-header">
          <div className="identity">
            <span className="brand">Alfie Designer</span>
            <span className="tagline">Générez des concepts créatifs en un brief.</span>
          </div>
          <div className="switchers">
            <ThemeToggle />
            <RoleSwitcher />
          </div>
        </div>

        <section className="card hero">
          <h1>Le copilote créatif des studios modernes</h1>
          <p>
            Accélérez la production de concepts, gardez le contrôle sur votre intention créative et partagez des briefs
            impeccables avec vos clients. Alfie vous aide à passer de l&apos;idée à la présentation en quelques minutes.
          </p>
          <div className="cta-group">
            <Link href="/auth/register" className="cta primary">
              Commencer gratuitement
            </Link>
            <Link href="/auth/login" className="cta secondary">
              Se connecter
            </Link>
            <Link href="/app?bypass=1" className="cta ghost">
              Voir l&apos;interface
            </Link>
          </div>
          <div className="metrics">
            <div className="metric">
              <span>10x</span>
              <small>plus rapide pour générer un concept exploitable</small>
            </div>
            <div className="metric">
              <span>3 min</span>
              <small>pour transformer un brief client en pistes créatives</small>
            </div>
            <div className="metric">
              <span>100%</span>
              <small>compatible avec vos process et vos outils existants</small>
            </div>
          </div>
        </section>

        <section className="preview card">
          <div className="preview-header">
            <h2>Essayez le cockpit créatif</h2>
            <p>
              Ajustez le brief, changez le format ou la cible et voyez instantanément comment Alfie structure la conversation
              et les livrables associés.
            </p>
          </div>
          <HomePageClient embedded />
        </section>

        <section className="feature-grid">
          {FEATURE_SECTIONS.map((feature) => (
            <article key={feature.title} className="feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </section>

        <footer className="landing-footer">
          <div className="footer-copy">
            <h2>Prêt à propulser vos pitchs ?</h2>
            <p>
              Créez un compte, connectez vos références visuelles et commencez à collaborer avec Alfie Designer dès
              aujourd&apos;hui.
            </p>
          </div>
          <div className="footer-cta">
            <Link href="/auth/register" className="cta primary">
              Ouvrir un compte
            </Link>
            <Link href="/docs" className="cta secondary">
              Consulter la documentation
            </Link>
          </div>
        </footer>

        <style jsx>{`
          .landing {
            display: flex;
            flex-direction: column;
            gap: 32px;
            padding-top: 40px;
            padding-bottom: 120px;
          }

          .landing-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            flex-wrap: wrap;
          }

          .identity {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .brand {
            font-size: 18px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .tagline {
            color: rgba(16, 17, 20, 0.6);
            font-size: 14px;
          }

          .switchers {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .hero {
            display: flex;
            flex-direction: column;
            gap: 28px;
            padding: 40px;
          }

          .hero h1 {
            margin: 0;
            font-size: clamp(2.5rem, 4vw, 3.5rem);
            line-height: 1.1;
          }

          .hero p {
            margin: 0;
            font-size: 18px;
            line-height: 1.6;
            max-width: 640px;
          }

          .cta-group {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }

          .cta {
            border-radius: 999px;
            font-weight: 600;
            padding: 12px 22px;
            transition: background 0.2s ease, color 0.2s ease, border 0.2s ease;
            border: 1px solid transparent;
          }

          .cta.primary {
            background: #2535a0;
            color: #ffffff;
          }

          .cta.primary:hover {
            background: #101f6e;
          }

          .cta.secondary {
            background: var(--card);
            border-color: var(--border);
            color: var(--fg);
          }

          .cta.secondary:hover {
            border-color: #c3c8d2;
          }

          .cta.ghost {
            background: transparent;
            border-color: transparent;
            color: #2535a0;
          }

          .cta.ghost:hover {
            text-decoration: underline;
          }

          .metrics {
            display: flex;
            flex-wrap: wrap;
            gap: 24px;
          }

          .metric {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 160px;
          }

          .metric span {
            font-size: 32px;
            font-weight: 700;
          }

          .metric small {
            color: rgba(16, 17, 20, 0.6);
            line-height: 1.4;
          }

          .preview {
            display: flex;
            flex-direction: column;
            gap: 24px;
            padding: 32px;
          }

          .preview-header {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .preview-header h2 {
            margin: 0;
            font-size: 24px;
          }

          .preview-header p {
            margin: 0;
            color: rgba(16, 17, 20, 0.7);
            line-height: 1.5;
            max-width: 640px;
          }

          .feature-grid {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          }

          .feature-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .feature-card h3 {
            margin: 0;
            font-size: 20px;
          }

          .feature-card p {
            margin: 0;
            line-height: 1.5;
            color: rgba(16, 17, 20, 0.7);
          }

          .landing-footer {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
            align-items: center;
            justify-content: space-between;
            padding: 40px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 18px;
          }

          .footer-copy {
            max-width: 520px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .footer-copy h2 {
            margin: 0;
            font-size: 28px;
          }

          .footer-copy p {
            margin: 0;
            line-height: 1.5;
            color: rgba(16, 17, 20, 0.7);
          }

          .footer-cta {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }

          @media (max-width: 900px) {
            .hero,
            .preview,
            .landing-footer {
              padding: 28px;
            }

            .metrics {
              gap: 16px;
            }

            .metric {
              min-width: 140px;
            }
          }

          @media (max-width: 640px) {
            .landing {
              padding-top: 24px;
            }

            .hero {
              gap: 24px;
            }

            .hero h1 {
              font-size: 2.25rem;
            }

            .preview,
            .landing-footer {
              padding: 24px;
            }

            .footer-copy h2 {
              font-size: 24px;
            }
          }
        `}</style>
      </div>
    </main>
  );
}
