import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Bookmark, BookmarkCheck, Download, Play, Share2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MediaType = 'image' | 'video' | 'text';

interface MediaCardProps {
  type: MediaType;
  src?: string;
  title?: string;
  description?: string;
  caption?: string;
  onDownload?: () => void;
  onFavorite?: () => void;
  onVariants?: () => void;
  onCopyPlan?: () => void;
  isFavorite?: boolean;
  loading?: boolean;
  alt?: string;
  children?: ReactNode;
}

export function MediaCard({
  type,
  src,
  title,
  description,
  caption,
  onDownload,
  onFavorite,
  onVariants,
  onCopyPlan,
  isFavorite,
  loading,
  alt,
  children,
}: MediaCardProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-md">
        <Skeleton className="h-56 w-full rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    );
  }

  const actionButtonClass = 'rounded-full border-slate-200 shadow-md hover:shadow-lg';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-md transition-shadow duration-200 hover:shadow-lg',
      )}
    >
      {type === 'image' && src && (
        <img
          src={src}
          alt={alt ?? caption ?? title ?? 'Création IA'}
          className="w-full rounded-xl object-cover"
        />
      )}

      {type === 'video' && src && (
        <div className="relative w-full overflow-hidden rounded-xl bg-slate-100">
          <video src={src} controls className="w-full rounded-xl" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/10">
            <Play className="h-10 w-10 text-white drop-shadow" />
          </div>
        </div>
      )}

      {type === 'text' && (
        <div className="prose prose-sm max-w-none text-slate-700">
          {children}
        </div>
      )}

      {(title || description || caption) && (
        <div className="space-y-1 text-sm text-slate-600">
          {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
          {description && <p>{description}</p>}
          {caption && <p className="text-slate-500">{caption}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {onDownload && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            className={cn(actionButtonClass, 'gap-2 px-4 py-2 text-sm text-slate-700')}
          >
            <Download className="h-4 w-4 text-blue-600" />
            Télécharger
          </Button>
        )}

        {onFavorite && (
          <Button
            variant="outline"
            size="sm"
            onClick={onFavorite}
            className={cn(actionButtonClass, 'gap-2 px-4 py-2 text-sm text-slate-700')}
            aria-pressed={isFavorite}
          >
            {isFavorite ? (
              <BookmarkCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <Bookmark className="h-4 w-4 text-blue-600" />
            )}
            {isFavorite ? 'Favori' : 'Favori'}
          </Button>
        )}

        {type === 'image' && onVariants && (
          <Button
            variant="outline"
            size="sm"
            onClick={onVariants}
            className={cn(actionButtonClass, 'gap-2 px-4 py-2 text-sm text-slate-700')}
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            Variantes
          </Button>
        )}

        {type === 'video' && onCopyPlan && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyPlan}
            className={cn(actionButtonClass, 'gap-2 px-4 py-2 text-sm text-slate-700')}
          >
            <Share2 className="h-4 w-4 text-blue-600" />
            Copier le plan
          </Button>
        )}
      </div>
    </div>
  );
}
