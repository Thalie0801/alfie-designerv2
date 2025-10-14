import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { BookmarkCheck, Clock, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

export interface FavoriteItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  caption?: string;
  createdAt: string;
}

interface SidebarSessionProps {
  history: string[];
  onHistorySelect: (prompt: string) => void;
  favorites: FavoriteItem[];
  onRemoveFavorite: (id: string) => void;
  isOpen: boolean;
  className?: string;
}

export function SidebarSession({ history, onHistorySelect, favorites, onRemoveFavorite, isOpen, className }: SidebarSessionProps) {
  const hasHistory = history.length > 0;
  const hasFavorites = favorites.length > 0;

  const sortedFavorites = useMemo(
    () => favorites.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [favorites],
  );

  return (
    <aside
      className={cn(
        'hidden h-full w-full max-w-xs flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-md transition-all duration-200 lg:flex',
        !isOpen && 'lg:hidden',
        className,
      )}
      aria-label="Historique de session"
    >
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Clock className="h-4 w-4 text-blue-600" />
          Historique
        </div>
        <ScrollArea className="max-h-48">
          <div className="flex flex-col gap-2">
            {hasHistory ? (
              history.map((item, index) => (
                <button
                  key={`${item}-${index}`}
                  type="button"
                  onClick={() => onHistorySelect(item)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {item}
                </button>
              ))
            ) : (
              <p className="text-xs text-slate-400">Aucun prompt pour le moment.</p>
            )}
          </div>
        </ScrollArea>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <BookmarkCheck className="h-4 w-4 text-emerald-500" />
          Favoris
        </div>
        <ScrollArea className="max-h-72">
          <div className="grid grid-cols-2 gap-2">
            {hasFavorites ? (
              sortedFavorites.map((favorite) => (
                <div
                  key={favorite.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm"
                >
                  {favorite.type === 'image' ? (
                    <img src={favorite.url} alt={favorite.caption ?? 'Favori'} className="h-24 w-full object-cover" />
                  ) : (
                    <video src={favorite.url} className="h-24 w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-slate-900/20 opacity-0 transition group-hover:opacity-100" />
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => onRemoveFavorite(favorite.id)}
                    className="absolute right-2 top-2 h-8 w-8 rounded-full border border-white/40 bg-white/80 text-xs text-white shadow-md backdrop-blur hover:bg-white"
                    aria-label="Supprimer des favoris"
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="col-span-2 text-xs text-slate-400">Ajoutez des médias pour les retrouver ici.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
