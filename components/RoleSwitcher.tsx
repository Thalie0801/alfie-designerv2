"use client";

import { useCallback, useState } from "react";

type Role = "admin" | "client";

async function updateRole(role: Role) {
  const response = await fetch("/api/role/set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    throw new Error(`unable to switch role (${response.status})`);
  }
}

export default function RoleSwitcher() {
  const [pendingRole, setPendingRole] = useState<Role | null>(null);

  const handleSwitch = useCallback(async (role: Role) => {
    if (pendingRole) {
      return;
    }
    setPendingRole(role);
    try {
      await updateRole(role);
      window.location.reload();
    } catch (error) {
      console.error("[role-switcher]", error);
      setPendingRole(null);
    }
  }, [pendingRole]);

  return (
    <div style={{ display: "inline-flex", gap: 8 }}>
      <button
        type="button"
        onClick={() => handleSwitch("client")}
        disabled={pendingRole !== null}
        style={{
          appearance: "none",
          borderRadius: 999,
          border: `1px solid var(--border)`,
          background: "var(--card)",
          color: "var(--fg)",
          cursor: pendingRole ? "wait" : "pointer",
          fontSize: 14,
          padding: "6px 14px",
        }}
      >
        Voir comme client
      </button>
      <button
        type="button"
        onClick={() => handleSwitch("admin")}
        disabled={pendingRole !== null}
        style={{
          appearance: "none",
          borderRadius: 999,
          border: `1px solid var(--border)`,
          background: "var(--card)",
          color: "var(--fg)",
          cursor: pendingRole ? "wait" : "pointer",
          fontSize: 14,
          padding: "6px 14px",
        }}
      >
        Voir comme admin
      </button>
    </div>
  );
}
