import React, { useEffect, useState } from "react";
import { ChatContext } from "./chat-context";

export { useChat } from "./chat-context";

export function ChatProvider({
  brandId,
  userId,
  children,
}: {
  brandId: string;
  userId?: string;
  children: React.ReactNode;
}) {
  const [chatId, setChatId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let stored =
      typeof window !== "undefined" ? localStorage.getItem("alfie.chatId") || undefined : undefined;
    const ensure = async () => {
      if (!stored) {
        const r = await fetch("/api/alfie/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brandId, userId }),
        });
        const j = await r.json();
        stored = j.chatId as string | undefined;
        if (stored && typeof window !== "undefined") {
          localStorage.setItem("alfie.chatId", stored);
        }
      }
      setChatId(stored);
    };
    ensure();
  }, [brandId, userId]);

  async function send(text: string) {
    if (!chatId) throw new Error("chat_not_ready");
    const r = await fetch("/api/alfie/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chatId, text }),
    });
    const j = await r.json();
    return ((j.messages as any[]) || []).map((m) => ({
      text: m.text as string,
      quick: (m.quick as string[]) || undefined,
    }));
  }

  return <ChatContext.Provider value={{ chatId, send }}>{children}</ChatContext.Provider>;
}
