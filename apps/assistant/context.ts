export type HostId = "designer" | "editorial";

export function detectHost(req: { headers?: any; env?: any }): HostId {
  const h = String(req?.headers?.host || "").toLowerCase();
  if (h.includes("aeditus.com")) return "editorial";
  if (h.includes("designer.")) return "designer";
  const env = String(process.env.HOST || "").toLowerCase();
  if (env.includes("editorial")) return "editorial";
  return "designer";
}
