import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import alfieMain from "@/assets/alfie-main.png";
import { MediaCard } from "./MediaCard";
import { Loader2, Sparkles } from "lucide-react";
import { Fragment, ReactNode, useMemo } from "react";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  timestamp?: string;
  onDownloadImage?: () => void;
  onDownloadVideo?: () => void;
  isStatus?: boolean;
  generationType?: "image" | "video" | "text";
  isLoading?: boolean;
}

/* ---------- helpers rendu texte (sans lib externe) ---------- */

/** transforme les URLs en <a> … */
function linkify(text: string): (string | JSX.Element)[] {
  const urlRe = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;!?:)\]])/gi;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(text))) {
    const [full] = m;
    const start = m.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const href = full.startsWith("http") ? full : `https://${full}`;
    parts.push(
      <a
        key={`${href}-${start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted text-blue-600 hover:text-blue-700"
      >
        {full}
      </a>,
    );
    lastIndex = start + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/** très léger support **bold**, *italic*, `code` (inline) et ```code block``` */
function renderInlineFormatting(nodes: (string | JSX.Element)[]): ReactNode[] {
  const out: ReactNode[] = [];
  nodes.forEach((node, idx) => {
    if (typeof node !== "string") {
      out.push(node);
      return;
    }
    // code blocks ```
    const blockRe = /```([\s\S]*?)```/g;
    let last = 0;
    let m: RegExpExecArray | null;
    const fragments: ReactNode[] = [];
    while ((m = blockRe.exec(node))) {
      if (m.index > last) {
        fragments.push(node.slice(last, m.index));
      }
      const code = m[1].replace(/^\n+|\n+$/g, "");
      fragments.push(
        <pre
          key={`pre-${idx}-${m.index}`}
          className="my-2 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-[13px] leading-relaxed overflow-x-auto"
        >
          <code>{code}</code>
        </pre>,
      );
      last = m.index + m[0].length;
    }
    if (last < node.length) fragments.push(node.slice(last));

    // pour le reste : `code`, **bold**, *italic*
    fragments.forEach((frag, j) => {
      if (typeof frag !== "string") {
        out.push(frag);
        return;
      }
      // inline code
      const inlineParts = frag.split(/(`[^`]+`)/g).map((p, k) => {
        if (p.startsWith("`") && p.endsWith("`")) {
          return (
            <code key={`code-${idx}-${j}-${k}`} className="rounded bg-muted px-1 py-0.5 text-[12px]">
              {p.slice(1, -1)}
            </code>
          );
        }
        // bold then italic (naïf mais efficace)
        // bold
        const boldSplit = p.split(/(\*\*[^*]+\*\*)/g).map((bp, bi) => {
          if (bp.startsWith("**") && bp.endsWith("**")) {
            return (
              <strong key={`b-${idx}-${j}-${k}-${bi}`} className="font-semibold">
                {bp.slice(2, -2)}
              </strong>
            );
          }
          // italic
          const italicSplit = bp.split(/(\*[^*]+\*)/g).map((ip, ii) => {
            if (ip.startsWith("*") && ip.endsWith("*")) {
              return (
                <em key={`i-${idx}-${j}-${k}-${bi}-${ii}`} className="italic">
                  {ip.slice(1, -1)}
                </em>
              );
            }
            return ip;
          });
          return <Fragment key={`f-${idx}-${j}-${k}-${bi}`}>{italicSplit}</Fragment>;
        });
        return <Fragment key={`frag-${idx}-${j}-${k}`}>{boldSplit}</Fragment>;
      });

      out.push(<Fragment key={`inline-${idx}-${j}`}>{inlineParts}</Fragment>);
    });
  });
  return out;
}

/** transforme les \n en <br/> tout en gardant nos éléments formatés */
function withLineBreaks(nodes: ReactNode[]): ReactNode[] {
  const out: ReactNode[] = [];
  nodes.forEach((n, i) => {
    if (typeof n === "string") {
      const parts = n.split("\n");
      parts.forEach((p, pi) => {
        out.push(p);
        if (pi < parts.length - 1) out.push(<br key={`br-${i}-${pi}`} />);
      });
    } else {
      out.push(n);
    }
  });
  return out;
}

function renderContentSafe(content: string): ReactNode {
  const trimmed = content?.toString()?.slice(0, 8000) ?? "";
  const linked = linkify(trimmed);
  const formatted = renderInlineFormatting(linked);
  return withLineBreaks(formatted);
}

/* ------------------------- composant ------------------------- */

export function ChatBubble({
  role,
  content,
  imageUrl,
  videoUrl,
  timestamp,
  onDownloadImage,
  onDownloadVideo,
  isStatus,
  generationType,
  isLoading,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const formattedDate = useMemo(() => {
    if (!timestamp) return null;
    try {
      return new Date(timestamp).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  }, [timestamp]);

  const bubbleClasses = cn(
    "rounded-2xl border px-4 py-3 text-sm transition-all duration-200 shadow-sm",
    isUser
      ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 text-slate-900"
      : "bg-white border-slate-200 text-slate-900 hover:shadow-md",
  );

  const statusLabel =
    generationType === "video"
      ? "🎬 Génération vidéo"
      : generationType === "text"
        ? "💬 Réponse d’Alfie"
        : "✨ Génération image";

  return (
    <div className={cn("flex gap-2 sm:gap-3 group", isUser ? "justify-end" : "justify-start")}>
      {role === "assistant" && (
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
          <AvatarImage src={`${alfieMain}?v=2`} alt="Alfie" />
          <AvatarFallback className="bg-blue-50 text-blue-700">AF</AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "flex flex-col gap-1.5 sm:gap-2 max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]",
          isUser && "items-end",
        )}
      >
        {isStatus ? (
          <div className={bubbleClasses}>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-blue-600" />
                ) : (
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 animate-pulse" />
                )}
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-semibold text-slate-900">{statusLabel}</p>
                <p className="text-xs sm:text-sm text-slate-600">{content}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {imageUrl && (
              <MediaCard
                type="image"
                url={imageUrl}
                alt={content || "Image générée par Alfie"}
                caption={content}
                onDownload={onDownloadImage}
              />
            )}
            {videoUrl && (
              <MediaCard
                type="video"
                url={videoUrl}
                alt={content || "Vidéo générée par Alfie"}
                caption={content}
                onDownload={onDownloadVideo}
              />
            )}
            {!imageUrl && !videoUrl && (
              <div className={bubbleClasses}>
                <div className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base break-words">
                  {renderContentSafe(content)}
                </div>
              </div>
            )}
          </div>
        )}

        {formattedDate && !isStatus && (
          <p className="text-[10px] sm:text-xs text-slate-400 px-1 sm:px-2">{formattedDate}</p>
        )}
      </div>

      {role === "user" && (
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
          <AvatarFallback className="bg-blue-50 text-blue-700 font-semibold">Tu</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
