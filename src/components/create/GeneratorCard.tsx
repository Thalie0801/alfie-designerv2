import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Toolbar, GeneratorMode, RatioOption } from './Toolbar';
import { MediaCard } from './MediaCard';
import { Wand2, ImagePlus, Send, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeneratorCardProps {
  preview?: {
    type: 'image' | 'video';
    url: string;
    alt: string;
    caption?: string;
    onDownload?: () => void;
  } | null;
  mode: GeneratorMode;
  onModeChange: (mode: GeneratorMode) => void;
  ratio: RatioOption;
  onRatioChange: (ratio: RatioOption) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isSendDisabled: boolean;
  isTextareaDisabled: boolean;
  isLoading: boolean;
  generationStatus: { type: string; message: string } | null;
  onUploadClick: () => void;
  uploadingImage: boolean;
  uploadedImage?: string | null;
  onRemoveUpload?: () => void;
  showVideoDurationChips: boolean;
  selectedDuration: 'short' | 'medium' | 'long';
  onDurationChange: (duration: 'short' | 'medium' | 'long') => void;
  onForceVideo: () => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export function GeneratorCard({
  preview,
  mode,
  onModeChange,
  ratio,
  onRatioChange,
  inputValue,
  onInputChange,
  onSend,
  onKeyDown,
  isSendDisabled,
  isTextareaDisabled,
  isLoading,
  generationStatus,
  onUploadClick,
  uploadingImage,
  uploadedImage,
  onRemoveUpload,
  showVideoDurationChips,
  selectedDuration,
  onDurationChange,
  onForceVideo,
  inputRef,
}: GeneratorCardProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef || internalRef;

  const handleMagicFocus = () => {
    textareaRef.current?.focus();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-xl">🐾</div>
          <div>
            <p className="text-sm font-medium text-slate-500">Alfie Studio</p>
            <p className="text-lg font-semibold text-slate-900">Générateur créatif</p>
          </div>
        </div>

        <div className="space-y-4">
          {preview ? (
            <MediaCard
              type={preview.type}
              url={preview.url}
              alt={preview.alt}
              caption={preview.caption}
              onDownload={preview.onDownload}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <div className="flex h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-50 via-white to-slate-100">
                <Sparkles className="h-6 w-6 text-blue-500" />
                <p className="text-sm text-slate-500">Partage ton idée pour voir un aperçu ici.</p>
              </div>
            </div>
          )}

          {generationStatus && (
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-sm font-medium text-blue-700 shadow-sm animate-fade-in flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-pulse" />
              {generationStatus.message}
            </div>
          )}

          <Toolbar mode={mode} onModeChange={onModeChange} ratio={ratio} onRatioChange={onRatioChange} />

          {showVideoDurationChips && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">Durée souhaitée :</span>
                {(
                  [
                    { value: 'short', label: '10-12s loop (1 Woof)' },
                    { value: 'medium', label: '~20s (2 Woofs)' },
                    { value: 'long', label: '~30s (3 Woofs)' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onDurationChange(option.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                      selectedDuration === option.value
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-slate-400">💡 1 clip Sora = 1 Woof</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm text-slate-600">
                <p>🎬 Lance la génération vidéo directement depuis le chat.</p>
                <Button
                  size="sm"
                  className="rounded-full bg-blue-600 text-white hover:bg-blue-700"
                  onClick={onForceVideo}
                  disabled={isSendDisabled}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> Générer la vidéo (2 Woofs)
                </Button>
              </div>
            </div>
          )}

          {uploadedImage && (
            <div className="group relative flex items-center gap-3 rounded-2xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 shadow-sm transition-all hover:shadow-md animate-fade-in">
              <div className="relative overflow-hidden rounded-xl">
                <img src={uploadedImage} alt="Image ajoutée" className="h-20 w-20 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Image source prête
                </p>
                <p className="text-xs text-slate-600 mt-1">Utilisée pour la prochaine génération</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-slate-600 hover:bg-white/80 hover:text-red-600 transition-colors"
                onClick={onRemoveUpload}
              >
                ✕ Retirer
              </Button>
            </div>
          )}
        </div>

        <div className="md:static md:bg-transparent md:p-0">
          <div className="sticky bottom-4 z-10 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xl md:static md:shadow-sm md:border">
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full text-slate-600 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:text-blue-600 transition-all hover:scale-105"
                  onClick={handleMagicFocus}
                  aria-label="Suggestions créatives"
                >
                  <Wand2 className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full text-slate-600 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:text-blue-600 transition-all hover:scale-105"
                  onClick={onUploadClick}
                  disabled={uploadingImage}
                  aria-label="Téléverser une image"
                >
                  {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                </Button>
              </div>
              <Textarea
                ref={textareaRef}
                placeholder="Décris ton idée à Alfie... (Shift + Enter pour nouvelle ligne)"
                value={inputValue}
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={onKeyDown}
                disabled={isTextareaDisabled}
                className="min-h-[120px] flex-1 resize-none rounded-2xl border-slate-200 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-blue-500 transition-shadow disabled:opacity-60"
                style={{
                  WebkitTextFillColor: '#111827',
                  color: '#111827',
                  zIndex: 2,
                }}
              />
              <Button
                type="button"
                onClick={onSend}
                disabled={isSendDisabled}
                className="h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 text-white transition-all hover:shadow-lg hover:scale-105 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
