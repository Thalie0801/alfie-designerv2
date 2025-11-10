// src/components/AlfieChat.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/useLocalStorage";

type Role = "user" | "assistant" | "system";
type ChatMsg = { id: string; role: Role; content: string };

function uid() {
  return "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const QUICK = [
  {
    label: "🎯 1 visuel 1:1",
    prompt: "Génère un visuel carré (1:1) pour Instagram sur le thème 'nouvelle collection'.",
  },
  { label: "📱 3 stories 9:16", prompt: "Crée 3 stories verticales 9:16 avec CTA 'Découvrir' pour -20% ce week-end." },
  {
    label: "▶️ Mini script vidéo",
    prompt: "Écris un script court (3 scènes) pour une vidéo produit, ton premium, 20s.",
  },
];

export default function AlfieChat() {
  const [messages, setMessages] = useLocalStorage<ChatMsg[]>("alfie:chat", [
    {
      id: "welcome",
      role: "assistant",
      content: "Salut, je suis Alfie. Dis-moi ce que tu veux créer (image, carrousel, vidéo) et je m’occupe du reste.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  const pushAssistant = (content: string) =>
    setMessages((prev) => [...prev, { id: uid(), role: "assistant", content }]);

  const runSlashCommand = async (cmd: string) => {
    if (cmd === "/clear") {
      setMessages([{ id: "welcome", role: "assistant", content: "Historique effacé. On repart !" }]);
      return true;
    }
    if (cmd === "/help") {
      pushAssistant(
        [
          "Commandes rapides:",
          "• /clear — effacer l'historique",
          "• /help — afficher l'aide",
          "Astuce: commence par “Image…”, “Vidéo…”, “Carrousel…” pour être précis.",
        ].join("\n"),
      );
      return true;
    }
    return false;
  };

  const handleSend = useCallback(
    async (forced?: string) => {
      const content = (forced ?? input).trim();
      if (!content || busy) return;

      if (content.startsWith("/")) {
        const handled = await runSlashCommand(content);
        if (handled) {
          setInput("");
          return;
        }
      }

      const userMsg: ChatMsg = { id: uid(), role: "user", content };
      setMessages((prev) => [...prev, userMsg, { id: uid(), role: "assistant", content: "⏳ Génération en cours…" }]);
      setInput("");
      setBusy(true);

      try {
        // mode dégradé (pas d’API obligatoire) : simple accusé réception
        await new Promise((r) => setTimeout(r, 350)); // petite pause UX
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            id: uid(),
            role: "assistant",
            content:
              "Reçu ✅. (Edge non branché) Dis-moi si tu veux que je prépare un carrousel de 5 slides ou une vidéo courte.",
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { id: uid(), role: "assistant", content: `❌ Erreur: ${err?.message ?? "échec inconnu"}` },
        ]);
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [input, busy, setMessages],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSend) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") setInput("");
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b bg-background/50 p-2">
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q.label}
              className={cn(
                "rounded-full border px-3 py-1 text-xs hover:bg-muted",
                busy && "cursor-not-allowed opacity-60",
              )}
              onClick={() => handleSend(q.prompt)}
              disabled={busy}
              title={q.prompt}
            >
              {q.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            Astuce: /help • Entrée = envoyer • Échap = vider
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
              m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "mr-auto bg-muted",
            )}
            aria-label={`${m.role} message`}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
          </div>
        ))}
        {busy && (
          <div className="mr-auto max-w-[75%] animate-pulse rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            Alfie réfléchit…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Décris ton besoin… (ex: Carrousel 5 slides -20% style premium)"
            className="flex-1 rounded-xl border px-3 py-2 outline-none"
            disabled={busy}
          />
          <button
            onClick={() => handleSend()}
            disabled={!canSend}
            className={cn(
              "rounded-xl px-4 py-2",
              canSend ? "bg-black text-white hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
