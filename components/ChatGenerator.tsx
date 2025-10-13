"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ChatGenerator.module.css";
import type { Brief } from "../lib/types/brief";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

interface QuotaSnapshotItem {
  label: string;
  used: number;
  limit: number;
  color: string;
}

interface ChatGeneratorProps {
  brief: Brief;
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
  quotaSnapshot?: QuotaSnapshotItem[];
  quotaStatusLabel?: string;
  brandName?: string;
  quotaLoading?: boolean;
  chatApiUrl?: string;
  className?: string;
  hideQuickIdeas?: boolean;
  hideQuota?: boolean;
  hideHeader?: boolean;
  resetToken?: number;
  onStreamingChange?: (streaming: boolean) => void;
}

const QUICK_IDEAS = [
  "Angles de carrousel",
  "Script vidéo 30s",
  "Variantes de CTA",
  "Légende + hashtags",
  "Idées visuels",
];

function createInitialMessages(): ChatMessage[] {
  return [
    {
      id: "assistant-intro",
      role: "assistant",
      content: "Salut, je suis Alfie. Donne-moi ton idée visuelle et je te guide jusqu'au livrable idéal.",
    },
  ];
}

function resolveId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveQuotaLabel(quota: QuotaSnapshotItem) {
  const limit = Math.max(0, quota.limit);
  const used = Math.max(0, quota.used);
  if (limit <= 0) {
    return `${used}`;
  }
  return `${used}/${limit}`;
}

function BrandQuotaRow({ quota }: { quota: QuotaSnapshotItem }) {
  const limit = Math.max(1, quota.limit);
  const used = Math.max(0, quota.used);
  const percentage = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className={styles.quotaRow}>
      <div className={styles.quotaRowHeader}>
        <span>{quota.label}</span>
        <span>{resolveQuotaLabel(quota)}</span>
      </div>
      <div className={styles.quotaTrack}>
        <div
          className={styles.quotaFill}
          style={{ width: `${percentage}%`, background: quota.color }}
        />
      </div>
    </div>
  );
}

function ChatGenerator({
  brief,
  pendingPrompt,
  onPromptConsumed,
  quotaSnapshot,
  quotaStatusLabel,
  brandName,
  quotaLoading,
  chatApiUrl,
  className,
  hideQuickIdeas = false,
  hideQuota = false,
  hideHeader = false,
  resetToken,
  onStreamingChange,
}: ChatGeneratorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => createInitialMessages());
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const lastResetTokenRef = useRef<number | undefined>(undefined);
  const endpoint = useMemo(
    () => chatApiUrl ?? process.env.NEXT_PUBLIC_ALFIE_ENDPOINT ?? "/api/alfie/chat",
    [chatApiUrl]
  );

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (typeof onStreamingChange === "function") {
      onStreamingChange(isStreaming);
    }
  }, [isStreaming, onStreamingChange]);

  const resetChat = useCallback(() => {
    const initial = createInitialMessages();
    setMessages(initial);
    messagesRef.current = initial;
    setInputValue("");
    setStreamingMessageId(null);
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    if (resetToken === undefined) {
      return;
    }
    if (lastResetTokenRef.current === undefined) {
      lastResetTokenRef.current = resetToken;
      return;
    }
    if (resetToken !== lastResetTokenRef.current) {
      lastResetTokenRef.current = resetToken;
      resetChat();
    }
  }, [resetToken, resetChat]);

  const upsertAssistantContent = useCallback((messageId: string, delta: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, content: `${message.content}${delta}` }
          : message
      )
    );
  }, []);

  const pushAssistantFallback = useCallback((messageId: string, text: string) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, content: text } : message))
    );
  }, []);

  const dispatchStreamingRequest = useCallback(
    async (updatedMessages: ChatMessage[], assistantId: string) => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: updatedMessages.map(({ role, content }) => ({ role, content })),
            brief,
            stream: true,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Réponse inattendue du serveur");
        }

        if (!response.body) {
          const payload = await response.text();
          let assistantText = payload;
          try {
            const parsed = JSON.parse(payload);
            assistantText = parsed.message ?? parsed.delta ?? payload;
          } catch (error) {
            // ignore JSON parse errors, keep raw payload
          }
          pushAssistantFallback(assistantId, assistantText);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) {
            done = true;
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const line = event.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            if (payload === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(payload);
              const delta =
                typeof parsed === "string"
                  ? parsed
                  : typeof parsed.delta === "string"
                  ? parsed.delta
                  : typeof parsed.message === "string"
                  ? parsed.message
                  : "";
              if (delta) {
                upsertAssistantContent(assistantId, delta);
              }
            } catch (error) {
              upsertAssistantContent(assistantId, payload);
            }
          }
        }

        if (buffer.trim().length > 0) {
          try {
            const parsed = JSON.parse(buffer.trim());
            const delta = parsed.delta ?? parsed.message ?? "";
            if (delta) {
              upsertAssistantContent(assistantId, delta);
            }
          } catch (error) {
            upsertAssistantContent(assistantId, buffer);
          }
        }
      } catch (error) {
        const fallback =
          error instanceof Error
            ? `Je rencontre un souci : ${error.message}`
            : "Je rencontre un souci inattendu.";
        pushAssistantFallback(assistantId, fallback);
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    },
    [brief, endpoint, pushAssistantFallback, upsertAssistantContent]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const userMessage: ChatMessage = {
        id: resolveId(),
        role: "user",
        content: trimmed,
      };
      const assistantMessage: ChatMessage = {
        id: resolveId(),
        role: "assistant",
        content: "",
      };

      const baseMessages = messagesRef.current;
      const nextMessages = [...baseMessages, userMessage, assistantMessage];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setInputValue("");
      setIsStreaming(true);
      setStreamingMessageId(assistantMessage.id);

      const updatedMessages = [...baseMessages, userMessage];
      await dispatchStreamingRequest(updatedMessages, assistantMessage.id);
    },
    [dispatchStreamingRequest, isStreaming]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await sendMessage(inputValue);
    },
    [inputValue, sendMessage]
  );

  const handleQuickIdea = useCallback(
    async (idea: string) => {
      setInputValue(idea);
      await sendMessage(idea);
    },
    [sendMessage]
  );

  useEffect(() => {
    if (pendingPrompt && pendingPrompt.trim().length > 0) {
      setInputValue(pendingPrompt);
      void sendMessage(pendingPrompt);
      onPromptConsumed?.();
    }
  }, [pendingPrompt, onPromptConsumed, sendMessage]);

  const streamingLabel = useMemo(() => {
    if (!isStreaming || !streamingMessageId) return null;
    return "Alfie rédige en direct…";
  }, [isStreaming, streamingMessageId]);

  const renderMessageContent = useCallback(
    (message: ChatMessage) => {
      if (message.role === "assistant" && message.id === streamingMessageId && isStreaming) {
        if (message.content.trim().length === 0) {
          return (
            <span className={styles.typingDots} aria-live="polite" aria-label="Alfie écrit">
              <span />
              <span />
              <span />
            </span>
          );
        }
      }
      return message.content;
    },
    [isStreaming, streamingMessageId]
  );

  return (
    <section className={`${styles.container} ${className ?? ""}`.trim()}>
      <div className={styles.chatShell}>
        {!hideHeader && (
          <header className={styles.header}>
            <div className={styles.titleGroup}>
              <div className={styles.chatTitle}>Alfie — Chat Generator</div>
              <p className={styles.chatSubtitle}>
                Brief actif : {brief.deliverable === "carousel" ? `${brief.slides ?? 5} slides` : brief.deliverable === "video" ? `${brief.duration ?? 30}s` : "visuel unique"} · {brief.ratio} ({brief.resolution})
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span className={styles.statusBadge} data-streaming={isStreaming}>
                {isStreaming ? "Génération…" : "IA active"}
              </span>
              <button type="button" className={styles.resetButton} onClick={resetChat}>
                Réinitialiser
              </button>
            </div>
          </header>
        )}

        {!hideQuickIdeas && (
          <section className={styles.quickIdeas} aria-label="Idées rapides">
            <div className={styles.quickIdeasLabel}>Idées rapides</div>
            <div className={styles.quickIdeasChips}>
              {QUICK_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  className={styles.quickChip}
                  onClick={() => void handleQuickIdea(idea)}
                >
                  {idea}
                </button>
              ))}
            </div>

            {!hideQuota && (quotaLoading || (quotaSnapshot && quotaSnapshot.length > 0)) && (
              <div className={styles.quotaPanel}>
                <div className={styles.quotaPanelHeader}>
                  <span>
                    Quotas {brandName ? `— ${brandName}` : "marque"}
                  </span>
                  {quotaStatusLabel && <span className={styles.quotaStatus}>{quotaStatusLabel}</span>}
                </div>

                {quotaLoading && (!quotaSnapshot || quotaSnapshot.length === 0) ? (
                  <p className={styles.quotaLoading}>Chargement des quotas…</p>
                ) : (
                  <div className={styles.quotaStack}>
                    {(quotaSnapshot ?? []).map((quota) => (
                      <BrandQuotaRow key={quota.label} quota={quota} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <div className={styles.messagesArea}>
          <div ref={listRef} className={styles.messageList}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={styles.message}
                data-role={message.role}
                data-streaming={message.id === streamingMessageId && isStreaming}
              >
                {renderMessageContent(message)}
              </article>
            ))}
          </div>

          <div className={styles.composerWrapper}>
            <form className={styles.composerShell} onSubmit={handleSubmit}>
              <textarea
                className={styles.textarea}
                placeholder="Décris le rendu que tu veux obtenir…"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                disabled={isStreaming}
              />
              <button type="submit" className={styles.sendButton} disabled={isStreaming || inputValue.trim().length === 0}>
                {isStreaming ? "Génération…" : "Envoyer"}
              </button>
            </form>
            {streamingLabel && <p className={styles.streamingIndicator}>{streamingLabel}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}


export { ChatGenerator };
export default ChatGenerator;
