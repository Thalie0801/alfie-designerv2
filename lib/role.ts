import { cookies } from "next/headers";

export type AppRole = "admin" | "client";

export function getRole(): AppRole {
  const role = cookies().get("appRole")?.value;
  return role === "admin" ? "admin" : "client";
}

export const FEATURES_BY_ROLE = {
  admin: {
    showTrends: true,
    showTips: true,
  },
  client: {
    showTrends: true, // change à false si tu veux masquer pour le client
    showTips: true,
  },
} as const;
