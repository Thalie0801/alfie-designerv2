export const dynamic = "force-dynamic";
export const revalidate = 0;

import HomePageClient from "@/components/HomePageClient";

export default function Page() {
  return (
    <main className="container">
      <div className="card">
        <h1>Alfie Designer — en ligne ✅</h1>
        <p>
          Liens rapides : <a href="/app?bypass=1">/app</a> · <a href="/billing">/billing</a> ·{" "}
          <a href="/auth/register">/auth/register</a>
        </p>
        <p>
          Diagnostic : <a href="/api/health">/api/health</a>
        </p>
      </div>
      <HomePageClient />
    </main>
  );
}
