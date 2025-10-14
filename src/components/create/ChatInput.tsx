import { forwardRef, type KeyboardEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachmentClick?: () => void;
  uploadedImage?: string | null;
  onRemoveImage?: () => void;
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    { value, onChange, onSend, disabled, onKeyDown, onAttachmentClick, uploadedImage, onRemoveImage },
    ref,
  ) => {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
        {uploadedImage && (
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
            <div className="flex items-center gap-3">
              <img src={uploadedImage} alt="Image téléversée" className="h-12 w-12 rounded-xl object-cover" />
              <span>Image ajoutée</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-slate-500 hover:text-slate-700"
              onClick={onRemoveImage}
              aria-label="Retirer l’image"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Textarea
            ref={ref}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Décris ton idée à Alfie…"
            disabled={disabled}
            rows={3}
            className="min-h-[80px] resize-none rounded-2xl border-slate-200 bg-slate-50 text-base text-slate-900 placeholder:text-slate-400 focus-visible:ring-blue-500"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Shift+Entrée = nouvelle ligne</span>
              <span className="hidden sm:inline">•</span>
              <span>Cmd/Ctrl+Entrée = envoyer</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-10 w-10 rounded-full border border-dashed border-slate-300 text-slate-400', 'hover:text-slate-600')}
                onClick={onAttachmentClick}
                disabled={disabled}
                aria-label="Ajouter une pièce jointe"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                onClick={onSend}
                disabled={!value.trim() || disabled}
                className="flex h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg"
              >
                <Send className="h-4 w-4" />
                Envoyer
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

ChatInput.displayName = 'ChatInput';
