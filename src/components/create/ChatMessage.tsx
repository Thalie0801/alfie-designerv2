import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import alfieMain from '@/assets/alfie-main.png';
import { MediaCard, MediaType } from './MediaCard';

export interface CreateMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  created_at?: string;
  jobId?: string;
  jobStatus?: string;
  progress?: number;
  assetId?: string;
  assetType?: 'image' | 'video';
}

interface ChatMessageProps {
  message: CreateMessage;
  isFavorite?: boolean;
  onToggleFavorite?: (url: string, type: MediaType, caption?: string) => void;
  onDownload?: (url: string, type: MediaType) => void;
  onVariants?: () => void;
  onCopyPlan?: (plan: string) => void;
}

export function ChatMessage({
  message,
  isFavorite,
  onToggleFavorite,
  onDownload,
  onVariants,
  onCopyPlan,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasMedia = Boolean(message.imageUrl || message.videoUrl);
  const timestamp = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={cn('flex w-full gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className="mt-1 h-9 w-9 border border-slate-200 bg-white shadow-md">
          <img src={alfieMain} alt="Alfie" className="h-full w-full rounded-full object-cover" />
        </Avatar>
      )}

      <div
        className={cn(
          'relative max-w-full space-y-3 rounded-2xl border px-4 py-3 shadow-md transition-all duration-200 md:max-w-[70%]',
          isUser
            ? 'rounded-tr-sm border-blue-200 bg-blue-50 text-slate-900'
            : 'rounded-tl-sm border-slate-200 bg-white text-slate-900',
        )}
      >
        <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
          {message.content}
        </div>

        {hasMedia && (
          <MediaCard
            type={message.imageUrl ? 'image' : 'video'}
            src={message.imageUrl ?? message.videoUrl}
            caption={message.content.slice(0, 120)}
            onDownload={
              onDownload && message.imageUrl
                ? () => onDownload(message.imageUrl!, 'image')
                : onDownload && message.videoUrl
                  ? () => onDownload(message.videoUrl!, 'video')
                  : undefined
            }
            onFavorite={
              onToggleFavorite && message.imageUrl
                ? () => onToggleFavorite(message.imageUrl!, 'image', message.content)
                : onToggleFavorite && message.videoUrl
                  ? () => onToggleFavorite(message.videoUrl!, 'video', message.content)
                  : undefined
            }
            onVariants={message.imageUrl && onVariants ? () => onVariants() : undefined}
            onCopyPlan={message.videoUrl && onCopyPlan ? () => onCopyPlan(message.content) : undefined}
            isFavorite={isFavorite}
            alt={message.content}
          />
        )}

        {timestamp && (
          <div className="text-xs text-slate-400">{timestamp}</div>
        )}
      </div>

      {isUser && (
        <Avatar className="mt-1 h-9 w-9 border border-slate-200 bg-white shadow-md">
          <div className="flex h-full w-full items-center justify-center text-sm">👤</div>
        </Avatar>
      )}
    </div>
  );
}
