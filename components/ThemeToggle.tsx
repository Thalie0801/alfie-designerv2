"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = "/api/theme";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const current = (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  const handleToggle = useCallback(async () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: nextTheme }),
      });
      if (!response.ok) {
        throw new Error(`Failed to toggle theme: ${response.status}`);
      }
      window.location.reload();
    } catch (error) {
      console.error("[theme-toggle]", error);
      setLoading(false);
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      style={{
        alignItems: "center",
        appearance: "none",
        background: "var(--card)",
        border: `1px solid var(--border)`,
        borderRadius: 999,
        color: "var(--fg)",
        cursor: loading ? "wait" : "pointer",
        display: "inline-flex",
        fontSize: 14,
        gap: 8,
        padding: "6px 14px",
        transition: "background 0.2s ease, border 0.2s ease",
      }}
    >
      {loading ? "Chargement…" : theme === "dark" ? "Mode clair" : "Mode sombre"}
    </button>
  );
}
