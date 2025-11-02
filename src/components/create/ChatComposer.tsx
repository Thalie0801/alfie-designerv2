import { useEffect, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send, ImagePlus, Mic, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
}

const QUICK_CHIPS = [
  { label: 'Carrousel', fill: 'Fais-moi un carrousel de 5 visuels cohérents avec la marque.' },
  { label: 'Draft 10s', fill: 'Vidéo verticale 10s draft, ton punchy, texte court + CTA.' },
  { label: 'Budget d\'abord', fill: 'Propose la version la plus économe en woofs répondant au brief.' }
];

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
  onRemoveImage
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persister le brouillon dans localStorage
  useEffect(() => {
    if (!conversationId) return;
    const draftKey = `draft-${conversationId}`;
    
    if (value) {
      localStorage.setItem(draftKey, value);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [value, conversationId]);

  // Charger le brouillon au montage
  useEffect(() => {
    if (!conversationId) return;
    const draftKey = `draft-${conversationId}`;
    const draft = localStorage.getItem(draftKey);
    
    if (draft && !value) {
      onChange(draft);
    }
  }, [conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading) return;
    
    onSend();
    
    // Vider le champ et supprimer le brouillon
    onChange("");
    if (conversationId) {
      localStorage.removeItem(`draft-${conversationId}`);
    }
    
    // Scroll to bottom après envoi
    requestAnimationFrame(() => {
      const chatBottom = document.getElementById('chat-bottom');
      chatBottom?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const handleChipClick = (fillText: string) => {
    const newValue = value ? `${value}\n${fillText}` : fillText;
    onChange(newValue);
    textareaRef.current?.focus();
  };

  return (
    <div className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t p-3 sm:p-4 z-10 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4">
      <div className="max-w-4xl mx-auto space-y-2 sm:space-y-3">
        
        <div className="flex items-end gap-1.5 sm:gap-2">
          <div className="flex-1 relative">
            <TextareaAutosize
              ref={textareaRef}
              minRows={1}
              maxRows={5}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Décris ton idée à Alfie… (Shift+Entrée = nouvelle ligne)"
              disabled={disabled || isLoading}
              className="w-full resize-none bg-background border rounded-xl px-3 py-2.5 pr-11 sm:px-4 sm:py-3 sm:pr-12 focus:outline-none focus:ring-2 focus:ring-primary text-sm touch-manipulation"
            />
            
            <div className="absolute right-1.5 bottom-1.5 sm:right-2 sm:bottom-2 flex gap-0.5 sm:gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 touch-target"
                onClick={onUploadClick}
                disabled={uploadingImage || disabled}
              >
                <ImagePlus className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 touch-target"
                disabled
              >
                <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 touch-target"
                disabled
              >
                <Wand2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>

          <Button
            type="button"
            size="icon"
            className="h-12 w-12 shrink-0 touch-target"
            onClick={handleSend}
            disabled={disabled || isLoading || (!value.trim() && !uploadedImage)}
          >
            <Send className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>

        {QUICK_CHIPS.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1">
            {QUICK_CHIPS.map((chip) => (
              <Button
                key={chip.label}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs shrink-0 snap-start min-h-[44px]"
                onClick={() => handleChipClick(chip.fill)}
                disabled={disabled || isLoading}
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
              alt="Aperçu"
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover border"
            />
            {onRemoveImage && (
              <button
                onClick={onRemoveImage}
                className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-sm font-bold touch-target"
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
