import { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Trash2, PlayCircle, Image, AlertCircle } from 'lucide-react';
import { LibraryAsset } from '@/hooks/useLibraryAssets';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AssetCardProps {
  asset: LibraryAsset;
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
  daysUntilExpiry: number;
}

export function AssetCard({ 
  asset, 
  selected, 
  onSelect, 
  onDownload, 
  onDelete,
  daysUntilExpiry 
}: AssetCardProps) {
  const [imageError, setImageError] = useState(false);

  const getExpiryBadge = () => {
    if (daysUntilExpiry <= 3) {
      return <Badge variant="destructive" className="text-xs">J-{daysUntilExpiry}</Badge>;
    } else if (daysUntilExpiry <= 7) {
      return <Badge className="bg-orange-500 text-white text-xs">J-{daysUntilExpiry}</Badge>;
    } else {
      return <Badge variant="secondary" className="text-xs">J-{daysUntilExpiry}</Badge>;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} Mo`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    return `${seconds}s`;
  };

  return (
    <Card className={`group hover:shadow-lg transition-all ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-0 relative">
        {/* Checkbox de sélection */}
        <div className="absolute top-2 left-2 z-10">
          <Checkbox 
            checked={selected} 
            onCheckedChange={onSelect}
            className="bg-background/90 backdrop-blur border-2"
          />
        </div>

        {/* Badges en haut à droite */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
          {getExpiryBadge()}
          {asset.is_source_upload && (
            <Badge variant="outline" className="bg-background/90 backdrop-blur text-xs">
              Source
            </Badge>
          )}
          {asset.engine && (
            <Badge variant="outline" className="bg-background/90 backdrop-blur text-xs">
              {asset.engine}
            </Badge>
          )}
          {asset.woofs > 0 && (
            <Badge className="bg-purple-500 text-white text-xs">
              {asset.woofs} 🐕
            </Badge>
          )}
        </div>

        {/* Preview */}
        <div className="relative aspect-video bg-muted overflow-hidden rounded-t-lg">
          {asset.type === 'video' ? (
            <>
              {asset.output_url && !imageError ? (
                <video 
                  src={asset.output_url} 
                  className="w-full h-full object-cover"
                  controls
                  onError={() => setImageError(true)}
                />
              ) : asset.thumbnail_url && !imageError ? (
                <img 
                  src={asset.thumbnail_url} 
                  alt="Video thumbnail" 
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                  <PlayCircle className="h-16 w-16 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground text-center px-4">
                    {asset.status === 'processing' ? '⏳ Génération en cours... (2-5 min)' : 'Aperçu indisponible'}
                  </p>
                </div>
              )}
              {asset.duration_seconds && (
                <div className="absolute bottom-2 left-2">
                  <Badge className="bg-black/70 text-white text-xs">
                    <PlayCircle className="h-3 w-3 mr-1" />
                    {formatDuration(asset.duration_seconds)}
                  </Badge>
                </div>
              )}
            </>
          ) : (
            <>
              {asset.output_url && !imageError ? (
                <img 
                  src={asset.output_url} 
                  alt="Generated content" 
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                  {imageError ? (
                    <>
                      <AlertCircle className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">Erreur de chargement</p>
                    </>
                  ) : (
                    <Image className="h-16 w-16 text-muted-foreground" />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          {asset.prompt && (
            <p className="text-sm line-clamp-2 text-muted-foreground">
              {asset.prompt}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(asset.created_at), { 
                addSuffix: true, 
                locale: fr 
              })}
            </span>
            {asset.file_size_bytes && (
              <span>{formatFileSize(asset.file_size_bytes)}</span>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-3 pt-0 gap-2">
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1"
          onClick={onDownload}
          disabled={asset.type === 'video' && !asset.output_url}
          title={asset.type === 'video' && !asset.output_url ? 'Vidéo en cours de génération' : 'Télécharger'}
        >
          <Download className="h-4 w-4 mr-2" />
          {asset.type === 'video' && !asset.output_url ? 'En génération…' : 'Télécharger'}
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
