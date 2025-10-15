import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface MediaCardProps {
  type: 'image' | 'video';
  url: string;
  alt: string;
  caption?: string;
  onDownload?: () => void;
}

export function MediaCard({ type, url, alt, caption, onDownload }: MediaCardProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
        {type === 'image' ? (
          <img src={url} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <video src={url} controls className="h-full w-full" />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {caption && <p className="text-sm text-slate-500">{caption}</p>}
        {onDownload && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-100"
            onClick={onDownload}
          >
            <Download className="mr-2 h-4 w-4" /> Télécharger
          </Button>
        )}
      </div>
    </div>
  );
}
