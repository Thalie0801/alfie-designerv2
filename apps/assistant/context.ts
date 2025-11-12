export type HostId = "designer" | "editorial";

export type RequestLike = {
  headers?: Record<string, string | string[] | undefined> | Headers;
  env?: Record<string, unknown>;
};

export function detectHost(req: RequestLike): HostId {
  const rawHeader = (() => {
    const headers = req?.headers;
    if (!headers) return undefined;
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get("host") ?? undefined;
    }
    const record = headers as Record<string, string | string[] | undefined>;
    const value = record.host;
    if (Array.isArray(value)) return value[0];
    return value;
  })();

  const h = String(rawHeader ?? "").toLowerCase();
  if (h.includes("aeditus.com")) return "editorial";
  if (h.includes("designer.")) return "designer";

  const envSource = req?.env ?? {};
  const envHost = (envSource as Record<string, unknown>).HOST ?? process.env.HOST;
  const env = String(envHost ?? "").toLowerCase();
  if (env.includes("editorial")) return "editorial";
  if (env.includes("designer")) return "designer";
  return "designer";
}
