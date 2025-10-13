import type { NextApiRequest, NextApiResponse } from "next";
import { detectHost } from "../../../apps/assistant/context";
import { createSession } from "../../../apps/assistant/session";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const host = detectHost(req);
  const { brandId, userId } = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) || {};
  if (!brandId) return res.status(400).json({ error: "brandId_required" });
  const s = createSession(host, String(brandId), userId ? String(userId) : undefined);
  return res.status(201).json({ chatId: s.id, host: s.host });
}
