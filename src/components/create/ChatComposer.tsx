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
    <div className="fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur-md border-t border-border">
      {/* Composer */}
      <div className="mx-auto max-w-3xl p-2 flex items-end gap-3">
        <div className="flex-1 relative">
          <TextareaAutosize
            ref={textareaRef}
            minRows={1}
            maxRows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Décris ton idée à Alfie… (Shift+Entrée = nouvelle ligne)"
            disabled={disabled || isLoading}
            className="w-full resize-none rounded-2xl border border-input bg-card px-4 py-3 pr-24 text-[15px] text-foreground 
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring 
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
          
          {/* Action buttons inline */}
          <div className="absolute right-2 bottom-2 flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={onUploadClick}
              disabled={uploadingImage || disabled}
              title="Ajouter une image"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              disabled={disabled}
              title="Dicter (bientôt disponible)"
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              disabled={disabled}
              title="Suggestions créatives"
            >
              <Wand2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={disabled || isLoading || !value.trim()}
          className="shrink-0 h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-medium disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      {/* Quick action chips */}
      {QUICK_CHIPS.length > 0 && (
        <div className="mx-auto max-w-3xl px-4 pb-1.5 flex gap-2 overflow-x-auto">
          {QUICK_CHIPS.slice(0, 2).map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(chip.fill)}
              disabled={disabled || isLoading}
              className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm hover:bg-muted/80 
                         whitespace-nowrap transition-colors disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Uploaded image preview */}
      {uploadedImage && (
        <div className="mx-auto max-w-3xl px-4 pb-3">
          <div className="relative inline-block">
            <img
              src={uploadedImage}
              alt="Image uploadée"
              className="h-20 w-20 rounded-lg object-cover border border-border"
            />
            {onRemoveImage && (
              <button
                onClick={onRemoveImage}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground 
                           flex items-center justify-center text-xs font-bold hover:bg-destructive/90"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
