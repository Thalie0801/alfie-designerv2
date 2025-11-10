import { useCallback, useEffect, useMemo, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Send, ImagePlus, Mic, Wand2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wantsImageFromText } from "@/utils/alfieIntentDetector";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  onUploadClick?: () => void;
  uploadingImage?: boolean;
  conversationId?: string;
  uploadedImage?: string | null;
  onRemoveImage?: () => void;
  onQuickGenerate?: () => void;
  onHeightChange?: (height: number) => void;
}

const QUICK_CHIPS = [
  { label: "Carrousel", fill: "Fais-moi un carrousel de 5 visuels cohérents avec la marque." },
  { label: "Draft 10s", fill: "Vidéo verticale 10s draft, ton punchy, texte court + CTA." },
  { label: "Budget d'abord", fill: "Propose la version la plus économe en woofs répondant au brief." },
];

// petit util de debounce pour limiter les appels onHeightChange
function debounce<T extends (...args: any[]) => void>(fn: T, delay = 120) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), delay);
  };
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  isLoading,
  onUploadClick,
  uploadingImage,
  conversationId,
  uploadedImage,
  onRemoveImage,
  onQuickGenerate,
  onHeightChange,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const persistDraft = useCallback((key: string, data: string | null) => {
    try {
      if (data === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, data);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`[ChatComposer] Failed to persist draft ${key}`, error);
      }
    }
  }, []);

  const readDraft = useCallback((key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`[ChatComposer] Failed to read draft ${key}`, error);
      }
      return null;
    }
  }, []);

  const showQuickGenerate = useMemo(
    () => Boolean(onQuickGenerate) && wantsImageFromText(value) && value.trim().length > 10,
    [onQuickGenerate, value],
  );

  // Observer pour transmettre la hauteur réelle du composer au parent (debounced)
  useEffect(() => {
    if (!rootRef.current || !onHeightChange) return;
    const update = debounce(() => {
      const h = rootRef.current?.offsetHeight ?? 0;
      onHeightChange(h);
    }, 80);

    const ro = new ResizeObserver(update);
    ro.observe(rootRef.current);

    // mesure initiale
    update();

    return () => {
      ro.disconnect();
    };
  }, [onHeightChange]);

  // Persister le brouillon dans localStorage
  useEffect(() => {
    if (!conversationId) return;
    const draftKey = `draft-${conversationId}`;
    const val = value || "";
    if (val) {
      persistDraft(draftKey, val);
    } else {
      persistDraft(draftKey, null);
    }
  }, [conversationId, persistDraft, value]);

  // Charger le brouillon au montage
  useEffect(() => {
    if (!conversationId) return;
    const draftKey = `draft-${conversationId}`;
    const draft = readDraft(draftKey);
    if (draft && !value) {
      onChange(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, readDraft]);

  const doSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed && !uploadedImage) return;
    if (disabled || isLoading) return;

    onSend();

    // reset champ et brouillon
    onChange("");
    if (conversationId) {
      persistDraft(`draft-${conversationId}`, null);
    }

    // Scroll vers le bas après envoi
    requestAnimationFrame(() => {
      const chatBottom = document.getElementById("chat-bottom");
      chatBottom?.scrollIntoView({ behavior: "smooth" });
    });
  }, [value, uploadedImage, disabled, isLoading, onSend, onChange, conversationId, persistDraft]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter = nouvelle ligne
    if (e.key === "Enter" && e.shiftKey) return;

    // Enter = envoyer
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
      return;
    }

    // Ctrl/Cmd+Enter = envoyer
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      doSend();
    }
  };

  const handleChipClick = (fillText: string) => {
    const newValue = value ? `${value}\n${fillText}` : fillText;
    onChange(newValue);
    textareaRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-background via-background/98 to-background/95 backdrop-blur-xl border-t border-border/50 shadow-2xl pt-4 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pt-4 sm:px-4 sm:pb-4 z-10"
      role="region"
      aria-label="Zone de composition du message"
    >
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="flex items-end gap-1.5 sm:gap-2">
          <div className="flex-1 relative">
            <TextareaAutosize
              ref={textareaRef}
              minRows={1}
              maxRows={8}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Décris ton idée à Alfie… (Shift+Entrée = nouvelle ligne)"
              disabled={disabled || isLoading}
              aria-label="Saisir un message pour Alfie"
              className="w-full resize-none bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 pr-32 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm transition-all duration-200 hover:shadow-md touch-manipulation"
            />

            <div className="absolute right-2 bottom-2 flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors touch-target"
                onClick={onUploadClick}
                disabled={uploadingImage || disabled}
                aria-label="Uploader une image ou une vidéo"
                title="Uploader"
              >
                <ImagePlus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors touch-target"
                disabled
                aria-label="Dictée vocale (bientôt)"
                title="Dictée vocale (bientôt)"
              >
                <Mic className="h-4 w-4 text-gray-400 dark:text-gray-600" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors touch-target"
                disabled
                aria-label="Aides à la rédaction (bientôt)"
                title="Aides à la rédaction (bientôt)"
              >
                <Wand2 className="h-4 w-4 text-gray-400 dark:text-gray-600" />
              </Button>
            </div>
          </div>

          {showQuickGenerate && (
            <Button
              type="button"
              size="sm"
              onClick={onQuickGenerate}
              disabled={disabled || isLoading}
              className="gap-2 touch-target shrink-0 h-12"
              variant="secondary"
              aria-label="Générer maintenant"
              title="Générer maintenant"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Générer maintenant</span>
              <span className="sm:hidden">Générer</span>
            </Button>
          )}

          <Button
            type="button"
            size="icon"
            className="h-12 w-12 shrink-0 touch-target bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
            onClick={doSend}
            disabled={disabled || isLoading || (!value.trim() && !uploadedImage)}
            aria-label="Envoyer le message"
            title="Envoyer (Entrée)"
          >
            <Send className="h-5 w-5 text-white" />
          </Button>
        </div>

        {QUICK_CHIPS.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
            {QUICK_CHIPS.map((chip) => (
              <Button
                key={chip.label}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs shrink-0 snap-start min-h-[44px] rounded-xl border-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 shadow-sm"
                onClick={() => handleChipClick(chip.fill)}
                disabled={disabled || isLoading}
                aria-label={`Insérer : ${chip.label}`}
                title={`Insérer : ${chip.label}`}
              >
                {chip.label}
              </Button>
            ))}
          </div>
        )}

        {uploadedImage && (
          <div className="relative inline-block">
            <img
              src={uploadedImage}
              alt="Aperçu de la pièce jointe"
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover border"
            />
            {onRemoveImage && (
              <button
                onClick={onRemoveImage}
                className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-sm font-bold touch-target"
                aria-label="Retirer l’image"
                title="Retirer l’image"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
