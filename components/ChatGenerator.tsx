"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ChatGenerator.module.css";
import type { Brief } from "../lib/types/brief";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  attachments?: ChatMessageAttachment[];
}

interface ChatMessageAttachment {
  id: string;
  type: "image" | "video";
  url: string;
  provider?: string;
  format?: string;
  posterUrl?: string;
}

interface ChatGeneratorProps {
  brief: Brief;
  pendingPrompt?: string | null;
  onPromptConsumed?: () => void;
  brandName?: string;
  chatApiUrl?: string;
  className?: string;
  hideQuickIdeas?: boolean;
  hideHeader?: boolean;
  resetToken?: number;
  onStreamingChange?: (streaming: boolean) => void;
}

const LOVABLE_HANDSHAKE_TEXT =
  "Connexion à Lovable AI pour générer des images et vidéos…";

const QUICK_IDEAS = [
  "Idées visuelles",
  "Angles de carrousel",
  "Script vidéo 30s",
  "Variantes de CTA",
  "Légende + hashtags",
];

function createInitialMessages(): ChatMessage[] {
  return [
    {
      id: "assistant-intro",
      role: "assistant",
      content:
        "Salut, je suis Alfie. Dis-moi ce que tu veux créer et je m’occupe du meilleur format.",
      attachments: [],
    },
  ];
}

function resolveId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ChatGenerator({
  brief,
  pendingPrompt,
  onPromptConsumed,
  brandName,
  chatApiUrl,
  className,
  hideQuickIdeas = false,
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
      prev.map((message) => {
        if (message.id !== messageId) {
          return message;
        }

        if (message.content === LOVABLE_HANDSHAKE_TEXT) {
          return { ...message, content: delta };
        }

        return { ...message, content: `${message.content}${delta}` };
      })
    );
  }, []);

  const pushAssistantFallback = useCallback((messageId: string, text: string) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, content: text } : message))
    );
  }, []);

  const appendAttachment = useCallback(
    (messageId: string, attachment: ChatMessageAttachment) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const nextAttachments = Array.isArray(message.attachments)
            ? [...message.attachments, attachment]
            : [attachment];

          return { ...message, attachments: nextAttachments };
        })
      );
    },
    []
  );

  const produceAsset = useCallback(
    async (assistantId: string, userPrompt: string) => {
      const deliverable = brief.deliverable;
      if (deliverable !== "image" && deliverable !== "video") {
        return;
      }

      try {
        const response = await fetch("/api/alfie/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: userPrompt,
            deliverable,
            ratio: brief.ratio,
            resolution: brief.resolution,
            tone: brief.tone,
            ambiance: brief.ambiance,
            constraints: brief.constraints,
            brandId: brief.brandId,
            brandName,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Lovable ne répond pas");
        }

        const payload = (await response.json()) as {
          assetUrl?: string;
          type?: "image" | "video";
          message?: string;
          format?: string;
          posterUrl?: string;
          provider?: string;
        };

        if (payload.message && payload.message.trim().length > 0) {
          upsertAssistantContent(assistantId, `\n\n${payload.message}`);
        }

        if (payload.assetUrl) {
          appendAttachment(assistantId, {
            id: resolveId(),
            type: payload.type === "video" ? "video" : "image",
            url: payload.assetUrl,
            format: payload.format,
            posterUrl: payload.posterUrl,
            provider: payload.provider ?? "Lovable AI",
          });
        }
      } catch (error) {
        const fallbackMessage =
          error instanceof Error && error.message && !/unexpected token/i.test(error.message)
            ? `\n\nJe n'ai pas pu générer le rendu Lovable : ${error.message}`
            : "\n\nJe n'ai pas pu générer le rendu Lovable pour le moment.";
        upsertAssistantContent(assistantId, fallbackMessage);
      }
    },
    [appendAttachment, brandName, brief, upsertAssistantContent]
  );

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

        const contentType = response.headers.get("content-type") ?? "";
        const defaultErrorMessage =
          "Je ne parviens pas à contacter le service pour le moment. Peux-tu réessayer un peu plus tard ?";

        if (!contentType.includes("text/event-stream") || !response.body) {
          try {
            if (contentType.includes("application/json")) {
              const payload = await response.json();
              const assistantText =
                typeof payload === "string"
                  ? payload
                  : payload?.message ?? payload?.delta ?? payload?.error ?? "";
              pushAssistantFallback(
                assistantId,
                assistantText && `${assistantText}`.trim().length > 0
                  ? assistantText
                  : defaultErrorMessage
              );
              return;
            }

            const payload = await response.text();
            const trimmedPayload = payload.trim();

            if (/<!DOCTYPE|<html|<body/i.test(trimmedPayload)) {
              console.error("Réponse inattendue du service Alfie", trimmedPayload.slice(0, 120));
              pushAssistantFallback(assistantId, defaultErrorMessage);
              return;
            }

            pushAssistantFallback(
              assistantId,
              trimmedPayload.length > 0 ? trimmedPayload : defaultErrorMessage
            );
            return;
          } catch (error) {
            console.error("Impossible de lire la réponse Alfie", error);
            pushAssistantFallback(assistantId, defaultErrorMessage);
            return;
          }
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
        content: LOVABLE_HANDSHAKE_TEXT,
        attachments: [],
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
      await produceAsset(assistantMessage.id, trimmed);
    },
    [dispatchStreamingRequest, isStreaming, produceAsset]
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await sendMessage(inputValue);
    },
    [inputValue, sendMessage]
  );

  const handleQuickIdea = useCallback((idea: string) => {
    setInputValue((previous) => {
      if (!previous || previous.trim().length === 0) {
        return idea;
      }
      const separator = previous.endsWith(" ") ? "" : " ";
      return `${previous}${separator}${idea}`;
    });
  }, []);

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

  const handleSaveBrief = useCallback(() => {
    console.info("Brief enregistré", {
      brandId: brief.brandId,
      deliverable: brief.deliverable,
      ratio: brief.ratio,
    });
  }, [brief.brandId, brief.deliverable, brief.ratio]);

  const renderMessageContent = useCallback(
    (message: ChatMessage) => {
      const isAssistant = message.role === "assistant";
      const isTyping =
        isAssistant && message.id === streamingMessageId && isStreaming && message.content.trim().length === 0;

      const attachments = message.attachments ?? [];

      return (
        <div className={styles.messageContent}>
          {isTyping ? (
            <span className={styles.typingDots} aria-live="polite" aria-label="Alfie écrit">
              <span />
              <span />
              <span />
            </span>
          ) : message.content.trim().length > 0 ? (
            <p className={styles.messageText}>{message.content}</p>
          ) : null}

          {attachments.length > 0 && (
            <div className={styles.attachments}>
              {attachments.map((attachment) => (
                <figure key={attachment.id} className={styles.assetFrame} data-type={attachment.type}>
                  {attachment.type === "image" ? (
                    <img
                      src={attachment.url}
                      alt={
                        attachment.format
                          ? `Visuel généré (${attachment.format})`
                          : "Visuel généré par Alfie"
                      }
                      className={styles.assetMedia}
                      loading="lazy"
                    />
                  ) : (
                    <video
                      className={styles.assetMedia}
                      controls
                      preload="metadata"
                      poster={attachment.posterUrl}
                    >
                      <source src={attachment.url} />
                      Votre navigateur ne peut pas lire cette vidéo.
                    </video>
                  )}
                  <figcaption className={styles.assetMeta}>
                    <span className={styles.assetBadge}>Lovable AI</span>
                    <span className={styles.assetFormat}>{
                      attachment.format ?? `${brief.ratio} — ${brief.resolution}`
                    }</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      );
    },
    [brief.ratio, brief.resolution, isStreaming, streamingMessageId]
  );

  return (
    <section className={`${styles.container} ${className ?? ""}`.trim()}>
      <div className={styles.chatShell}>
        {!hideHeader && (
          <header className={styles.header}>
            <div className={styles.titleGroup}>
              <h2 id="creation-conversation" className={styles.chatTitle}>
                Conversation de création
              </h2>
              <p className={styles.chatSubtitle}>
                Brief actif : {brief.deliverable === "carousel"
                  ? `${brief.slides ?? 5} slides`
                  : brief.deliverable === "video"
                  ? `${brief.duration ?? 30}s`
                  : "visuel unique"}
                {" · "}
                {brief.ratio} ({brief.resolution})
              </p>
            </div>
            <div className={styles.headerMeta}>
              <div className={styles.headerBadges}>
                <span className={styles.statusBadge} data-streaming={isStreaming}>
                  {isStreaming ? "Génération…" : "IA active"}
                </span>
                <span className={styles.brandBadge}>Brand Kit appliqué — {brandName ?? "Marque"}</span>
              </div>
              <button type="button" className={styles.resetButton} onClick={resetChat}>
                Effacer le brief
              </button>
            </div>
          </header>
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
            {!hideQuickIdeas && (
              <div className={styles.quickIdeas} aria-label="Inspiration rapide">
                <span className={styles.quickIdeasLabel}>Inspiration rapide</span>
                <div className={styles.quickIdeasChips}>
                  {QUICK_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      className={styles.quickChip}
                      onClick={() => handleQuickIdea(idea)}
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form className={styles.composerShell} onSubmit={handleSubmit}>
              <textarea
                className={styles.textarea}
                placeholder="Décris le rendu que tu veux obtenir…"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                disabled={isStreaming}
              />
              <div className={styles.composerActions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isStreaming || inputValue.trim().length === 0}
                >
                  {isStreaming ? "Génération…" : "Générer"}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={handleSaveBrief}>
                  Enregistrer le brief
                </button>
                <a className={styles.libraryLink} href="/library">
                  Ouvrir dans la Bibliothèque
                </a>
              </div>
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
