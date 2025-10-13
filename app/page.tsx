export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Landing() {
  return (
    <main className="container">
      <div className="card">
        <h1>Alfie Designer — en ligne ✅</h1>
        <p>Tests rapides : <a href="/app?bypass=1">/app</a> · <a href="/api/health">/api/health</a></p>
      </div>
    </main>
  );
}
