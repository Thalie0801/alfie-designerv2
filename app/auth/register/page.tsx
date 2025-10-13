import { cookies } from "next/headers";
import Link from "next/link";
import RegisterForm from "@/components/auth/RegisterForm";

const REF_COOKIE = "ref";
const REF_MAX_AGE = 60 * 60 * 24 * 180;

type RegisterPageProps = {
  searchParams?: {
    ref?: string;
  };
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  const refCode = searchParams?.ref;
  if (refCode && typeof refCode === "string" && refCode.trim().length > 0) {
    cookies().set(REF_COOKIE, refCode.trim(), { path: "/", maxAge: REF_MAX_AGE });
  }

  return (
    <div className="container auth-page">
      <div className="card auth-card">
        <h1>Inscription</h1>
        <p>Créez votre accès Alfie en quelques secondes.</p>
        <RegisterForm />
        <p className="alt">
          Déjà inscrit ? <Link href="/auth/login">Se connecter</Link>
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
