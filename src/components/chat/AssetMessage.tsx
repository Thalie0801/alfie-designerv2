import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FolderOpen, Copy, PlayCircle, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface AssetMessageProps {
  assetId: string;
  type: 'image' | 'video';
  outputUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  woofsConsumed?: number;
  engine?: string;
  expiresAt: string;
  onOpenInLibrary?: () => void;
}

export function AssetMessage({
  assetId,
  type,
  outputUrl,
  thumbnailUrl,
  duration,
  width,
  height,
  woofsConsumed,
  engine,
  expiresAt,
  onOpenInLibrary
}: AssetMessageProps) {
  const [imageError, setImageError] = useState(false);

  const getDaysUntilExpiry = () => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(outputUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${assetId}.${type === 'image' ? 'png' : 'mp4'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Téléchargement démarré');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(outputUrl);
    toast.success('URL copiée');
  };

  const daysLeft = getDaysUntilExpiry();

  return (
    <Card className="max-w-md">
      <CardContent className="p-0">
        {/* Preview */}
        <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
          {type === 'video' ? (
            <>
              {thumbnailUrl && !imageError ? (
                <img 
                  src={thumbnailUrl} 
                  alt="Video thumbnail" 
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                  <PlayCircle className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
              {duration && (
                <Badge className="absolute bottom-2 left-2 bg-black/70 text-white">
                  <PlayCircle className="h-3 w-3 mr-1" />
                  {duration}s
                </Badge>
              )}
            </>
          ) : (
            <>
              {outputUrl && !imageError ? (
                <div className="relative group w-full h-full">
                  <img 
                    src={outputUrl} 
                    alt="Generated content" 
                    className="w-full h-full object-cover transition"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={handleDownload}
                      className="bg-white rounded-full p-3 shadow-lg hover:scale-110 transition-transform"
                      aria-label="Télécharger l'image"
                    >
                      <Download className="h-6 w-6 text-slate-900" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                  <ImageIcon className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </>
          )}

          {/* Top badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {engine && (
              <Badge variant="secondary" className="text-xs">
                {engine}
              </Badge>
            )}
            {woofsConsumed !== undefined && woofsConsumed > 0 && (
              <Badge className="bg-purple-500 text-white text-xs">
                −{woofsConsumed} 🐕
              </Badge>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {type === 'video' ? '🎬 Vidéo' : '🖼️ Image'} prête ✅
            </span>
            {width && height && (
              <span className="text-muted-foreground text-xs">
                {width}×{height}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Expire : J+{daysLeft}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-3 pt-0 flex gap-2">
        <Button 
          size="sm" 
          onClick={handleDownload}
          className="flex-1"
        >
          <Download className="h-4 w-4 mr-2" />
          Télécharger
        </Button>
        
        {onOpenInLibrary && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={onOpenInLibrary}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Bibliothèque
          </Button>
        )}
        
        <Button 
          size="sm" 
          variant="ghost"
          onClick={handleCopyUrl}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
