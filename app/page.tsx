export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies } from "next/headers";
import Link from "next/link";
import HomePageClient from "@/components/HomePageClient";
import ThemeToggle from "@/components/ThemeToggle";
import RoleSwitcher from "@/components/RoleSwitcher";

const REF_COOKIE = "ref";
const REF_MAX_AGE = 60 * 60 * 24 * 180;

type LandingPageProps = {
  searchParams?: {
    ref?: string;
  };
};

export default function Page({ searchParams }: LandingPageProps) {
  const refCode = searchParams?.ref;
  if (refCode && typeof refCode === "string" && refCode.trim().length > 0) {
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
            Composez vos briefs, laissez Alfie générer les idées, puis affinez-les dans votre dashboard. Un parcours pensé pour les équipes marketing pressées.
          </p>
          <div className="cta-row">
            <Link href="/auth/register" className="cta primary">
              Créer mon compte
            </Link>
            <Link href="/auth/login" className="cta secondary">
              J&apos;ai déjà un accès
            </Link>
            <Link href="/billing" className="cta tertiary">
              Voir les offres
            </Link>
          </div>
        </section>

        <section className="card flow">
          <h2>Un parcours clair</h2>
          <ol>
            <li>Landing &rarr; inscription en un clic.</li>
            <li>Choisissez votre plan et validez via Stripe.</li>
            <li>Accédez au dashboard Alfie et lancez vos campagnes.</li>
          </ol>
        </section>

        <section className="card app-preview">
          <h2>Essayez le générateur</h2>
          <p>Configurez un brief express, testez le chat et explorez les astuces d&apos;Alfie.</p>
          <HomePageClient embedded />
        </section>

        <footer className="meta">
          build: {process.env.NEXT_PUBLIC_BUILD_ID}
        </footer>
      </div>

      <style jsx>{`
        main {
          padding-bottom: 120px;
        }

        .landing {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .landing-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .identity {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .brand {
          font-size: 22px;
          font-weight: 600;
        }

        .tagline {
          font-size: 14px;
          color: rgba(16, 17, 20, 0.6);
        }

        :global([data-theme="dark"]) .tagline {
          color: rgba(255, 255, 255, 0.7);
        }

        .switchers {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .hero {
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: linear-gradient(135deg, rgba(96, 80, 255, 0.12), rgba(16, 28, 55, 0.05));
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.1;
        }

        .hero p {
          margin: 0;
          font-size: 16px;
          max-width: 520px;
          color: rgba(0, 0, 0, 0.65);
        }

        :global([data-theme="dark"]) .hero p {
          color: rgba(255, 255, 255, 0.7);
        }

        .cta-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .cta {
          border-radius: 999px;
          padding: 10px 18px;
          font-size: 15px;
          font-weight: 500;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .cta.primary {
          background: #6050ff;
          color: white;
          box-shadow: 0 12px 24px rgba(96, 80, 255, 0.2);
        }

        .cta.secondary {
          border: 1px solid var(--border);
          color: var(--fg);
          background: transparent;
        }

        .cta.tertiary {
          border: 1px dashed var(--border);
          color: var(--fg);
          background: transparent;
        }

        .cta:hover {
          transform: translateY(-1px);
        }

        .flow {
          display: grid;
          gap: 12px;
        }

        .flow ol {
          margin: 0;
          padding-left: 20px;
        }

        .app-preview {
          display: grid;
          gap: 24px;
        }

        .meta {
          text-align: right;
          opacity: 0.6;
          font-size: 12px;
        }

        @media (max-width: 768px) {
          .landing {
            gap: 20px;
          }

          .cta-row {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </main>
  );
}
