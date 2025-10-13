"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const supabase = createBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    try {
      await fetch("/api/auth/sync-plan", { method: "POST" });
    } catch (syncError) {
      console.error("[login] unable to sync plan", syncError);
    }

    router.push(nextPath);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </label>

      <label>
        Mot de passe
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? "Connexion…" : "Se connecter"}
      </button>

      <style jsx>{`
        .auth-form {
          display: grid;
          gap: 16px;
        }

        label {
          display: grid;
          gap: 8px;
          font-size: 14px;
        }

        input {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--fg);
        }

        .error {
          color: #c1121f;
          font-size: 14px;
        }

        button {
          border-radius: 999px;
          padding: 12px 18px;
          border: none;
          background: #6050ff;
          color: #fff;
          font-weight: 600;
          cursor: ${loading ? "wait" : "pointer"};
        }

        button:disabled {
          opacity: 0.7;
        }
      `}</style>
    </form>
  );
}
