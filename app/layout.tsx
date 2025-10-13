import React from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Alfie Designer",
  description: "Générateur de concepts créatifs assisté par Alfie.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body data-theme="light">
        {children}
        <style jsx global>{`
          :root { color-scheme: light; }
          html, body { background:#f7f7f8; color:#101114; }
          .dark, [data-theme="dark"] { background:#f7f7f8 !important; color:#101114 !important; }
        `}</style>
      </body>
    </html>
  );
}
