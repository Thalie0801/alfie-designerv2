import type { NextApiRequest, NextApiResponse } from "next";
import { getSession, saveSession } from "../../../apps/assistant/session";
import { detectHost } from "../../../apps/assistant/context";
import { handleUserText } from "../../../apps/assistant/router";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { chatId, text } = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) || {};
  if (!chatId || !text) return res.status(400).json({ error: "chatId_and_text_required" });

  const session = getSession(String(chatId));
  if (!session) return res.status(404).json({ error: "unknown_chat" });

  const host = detectHost(req);
  const out: Array<{ type: "text"; text: string; quick?: string[] }> = [];

  const ctx = {
    req,
    brandId: session.brandId,
    userId: session.userId,
    session: session.nudges || {},
    lastDeliverableId: session.lastDeliverableId,
    reply: async (message: string, opts?: { quick?: string[] }) =>
      out.push({ type: "text", text: message, quick: opts?.quick }),
  };

  await handleUserText(String(text), ctx);

  session.nudges = ctx.session;
  session.lastDeliverableId = ctx.lastDeliverableId;
  saveSession(session);

  return res.json({ messages: out, chat: { chatId: session.id, host } });
}
