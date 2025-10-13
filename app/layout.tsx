import type { Metadata } from "next";
import { cookies } from "next/headers";
import React from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Alfie Designer",
  description: "Générateur de concepts créatifs assisté par Alfie.",
};

const THEME_COOKIE = "theme";

function resolveTheme(): "light" | "dark" {
  try {
    const themeValue = cookies().get(THEME_COOKIE)?.value;
    if (themeValue === "dark" || themeValue === "light") {
      return themeValue;
    }
  } catch (error) {
    console.error("[layout] unable to read theme cookie", error);
  }
  return "light";
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = resolveTheme();

  return (
    <html lang="fr" data-theme={theme}>
      <body>
        {children}
        <style jsx global>{`
          *, *::before, *::after { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          html[data-theme="light"] {
            --bg: #f7f7f8;
            --fg: #101114;
            --card: #ffffff;
            --border: rgba(16, 17, 20, 0.08);
            color-scheme: light;
          }
          html[data-theme="dark"] {
            --bg: #0f1115;
            --fg: #f5f7fa;
            --card: #171a21;
            --border: rgba(245, 247, 250, 0.14);
            color-scheme: dark;
          }
          body {
            font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: var(--bg);
            color: var(--fg);
            min-height: 100vh;
            transition: background 0.3s ease, color 0.3s ease;
          }
          a {
            color: inherit;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 32px 20px 96px;
            width: 100%;
          }
          .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 24px 48px rgba(15, 17, 21, 0.06);
          }
          button {
            font: inherit;
          }
        `}</style>
      </body>
    </html>
  );
}
