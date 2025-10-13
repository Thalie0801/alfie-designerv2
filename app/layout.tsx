import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" data-theme="light">
      <body>
        {children}
        <style jsx global>{`
          :root { --bg:#f7f7f8; --fg:#101114; --card:#ffffff; --border:#e5e7eb; }
          html, body { background:var(--bg); color:var(--fg); margin:0; }
          .container { max-width:1200px; margin:0 auto; padding:16px 20px 80px; }
          .card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px; }
          a { color:#2535a0; text-decoration:none }
        `}</style>
      </body>
    </html>
  );
}
