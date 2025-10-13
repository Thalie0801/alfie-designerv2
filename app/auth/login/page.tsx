import { cookies } from "next/headers";
import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

const REF_COOKIE = "ref";
const REF_MAX_AGE = 60 * 60 * 24 * 180;

type LoginPageProps = {
  searchParams?: {
    ref?: string;
  };
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage({ searchParams }: LoginPageProps) {
  const refCode = searchParams?.ref;
  if (refCode && typeof refCode === "string" && refCode.trim().length > 0) {
    cookies().set(REF_COOKIE, refCode.trim(), { path: "/", maxAge: REF_MAX_AGE });
  }

  return (
    <div className="container auth-page">
      <div className="card auth-card">
        <h1>Connexion</h1>
        <p>Accédez à votre espace Alfie.</p>
        <LoginForm />
        <p className="alt">
          Pas encore de compte ? <Link href="/auth/register">Créer un compte</Link>
        </p>
      </div>

      <style jsx>{`
        .auth-card {
          display: grid;
          gap: 16px;
          max-width: 480px;
          margin: 0 auto;
        }

        .alt {
          font-size: 14px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
