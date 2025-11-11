import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import alfieMain from '@/assets/alfie-main.png';
import { MediaCard } from './MediaCard';
import { Loader2, Sparkles } from 'lucide-react';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  timestamp?: string;
  onDownloadImage?: () => void;
  onDownloadVideo?: () => void;
  isStatus?: boolean;
  generationType?: 'image' | 'video' | 'text';
  isLoading?: boolean;
}

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
  const isUser = role === 'user';
  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const bubbleClasses = cn(
    'rounded-2xl border px-4 py-3 text-sm transition-all duration-200 shadow-sm',
    isUser
      ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 text-slate-900'
      : 'bg-white border-slate-200 text-slate-900 hover:shadow-md'
  );

  const statusLabel =
    generationType === 'video'
      ? '🎬 Génération vidéo'
      : generationType === 'text'
        ? '💬 Réponse d’Alfie'
        : '✨ Génération image';

  return (
    <div className={cn(
      "flex gap-2 sm:gap-3 group",
      role === 'user' ? 'justify-end' : 'justify-start'
    )}>
      {role === 'assistant' && (
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
          <AvatarImage src={`${alfieMain}?v=2`} alt="Alfie" />
          <AvatarFallback className="bg-blue-50 text-blue-700">AF</AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn(
        "flex flex-col gap-1.5 sm:gap-2 max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]",
        role === 'user' && 'items-end'
      )}>

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
                alt={content || 'Image générée par Alfie'}
                caption={content}
                onDownload={onDownloadImage}
              />
            )}
            {videoUrl && (
              <MediaCard
                type="video"
                url={videoUrl}
                alt={content || 'Vidéo générée par Alfie'}
                caption={content}
                onDownload={onDownloadVideo}
              />
            )}
            {(!imageUrl && !videoUrl) && (
              <div className={bubbleClasses}>
                <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/__(.*?)__/g, '$1').replace(/\*(.*?)\*/g, '$1')}</p>
              </div>
            )}
          </div>
        )}

        {formattedDate && !isStatus && (
          <p className="text-[10px] sm:text-xs text-slate-400 px-1 sm:px-2">{formattedDate}</p>
        )}
      </div>

      {role === 'user' && (
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
          <AvatarFallback className="bg-blue-50 text-blue-700 font-semibold">Tu</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
