export type Json = Record<string, unknown>;

export async function callEdge<T = unknown>(
  fn: string,
  payload: Json,
  accessToken?: string
): Promise<T> {
  const res = await fetch(`/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Edge ${fn} ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}
