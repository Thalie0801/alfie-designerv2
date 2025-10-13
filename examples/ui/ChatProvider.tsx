import React, { createContext, useCallback, useContext, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

type ChatCtx = {
  messages: Message[];
  pending: boolean;
  send: (text: string) => Promise<Message>;
};

const ChatContext = createContext<ChatCtx>({
  messages: [],
  pending: false,
  send: async () => ({ role: "assistant", content: "" }),
});

export const useChat = () => useContext(ChatContext);

const DEFAULT_BRIEF = {
  deliverable: "image",
  ratio: "9:16",
  resolution: "1080x1920",
  useBrandKit: false,
};

async function requestAssistant(messages: Message[]) {
  const response = await fetch("/api/alfie/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, brief: DEFAULT_BRIEF, stream: false }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`chat_request_failed_${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      if (buffer.length > 0) {
        assistantText += parseEvents(buffer);
      }
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lastSeparator = buffer.lastIndexOf("\n\n");
    if (lastSeparator === -1) {
      continue;
    }
    const chunk = buffer.slice(0, lastSeparator + 2);
    buffer = buffer.slice(lastSeparator + 2);
    assistantText += parseEvents(chunk);
  }

  return assistantText.trim();
}

function parseEvents(block: string) {
  let text = "";
  const events = block.split("\n\n");
  for (const event of events) {
    if (!event.startsWith("data:")) continue;
    const payload = event.slice(5).trim();
    if (payload === "[DONE]" || payload.length === 0) continue;
    try {
      const json = JSON.parse(payload) as { delta?: string; message?: string };
      if (typeof json.delta === "string") {
        text += json.delta;
      }
      if (typeof json.message === "string") {
        text += json.message;
      }
    } catch (error) {
      console.warn("[ChatProvider] unable to parse SSE payload", payload, error);
    }
  }
  return text;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);

  const send = useCallback(
    async (text: string) => {
      const userMessage: Message = { role: "user", content: text };
      const history = [...messages, userMessage];
      setMessages(history);
      setPending(true);
      try {
        const assistantContent = await requestAssistant(history);
        const assistantMessage: Message = { role: "assistant", content: assistantContent };
        setMessages((current) => [...current, assistantMessage]);
        return assistantMessage;
      } finally {
        setPending(false);
      }
    },
    [messages]
  );

  return (
    <ChatContext.Provider value={{ messages, pending, send }}>
      {children}
    </ChatContext.Provider>
  );
}
