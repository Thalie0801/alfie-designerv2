import { useMemo, useState } from 'react';
import { uploadAsset } from '@/lib/cloudinary/uploadAsset';
import { videoUrl } from '@/lib/cloudinary/videoUrls';
import { reelFromImageUrl } from '@/lib/cloudinary/videoFromImageUrl';
import { extractCloudNameFromUrl } from '@/lib/cloudinary/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function VideoBuilder({
  bgImagePublicId,
  bgImageUrl,
}: {
  bgImagePublicId?: string;
  bgImageUrl?: string;
}) {
  const [publicId, setPublicId] = useState('');
  const [title, setTitle] = useState('Titre vidéo');
  const [subtitle, setSubtitle] = useState('Sous-titre');
  const [mode, setMode] = useState<'upload' | 'fromImage'>('fromImage');
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    
    // Validation du fichier
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (f.size > maxSize) {
      alert('❌ Fichier trop volumineux (max 100MB)');
      return;
    }
    
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(f.type)) {
      alert('❌ Format non supporté. Utilisez MP4, WebM ou MOV.');
      return;
    }
    
    setUploading(true);
    try {
      const r = await uploadAsset(f, { folder: 'alfie/demo/videos' });
      setPublicId(r.public_id);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('❌ Erreur lors de l\'upload. Veuillez réessayer.');
    } finally {
      setUploading(false);
    }
  }

  const cloudName =
    extractCloudNameFromUrl(bgImageUrl) ||
    (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);

  const preview = useMemo(() => {
    if (!cloudName) return '';
    if (mode === 'upload' && publicId) {
      return videoUrl(publicId, {
        cloudName,
        title,
        subtitle,
        width: 1080,
        height: 1920,
        duration: 8,
      });
    }
    if (mode === 'fromImage' && bgImagePublicId) {
      return reelFromImageUrl('alfie/templates/blank_1080x1920_6s', bgImagePublicId, {
        cloudName,
        title,
        subtitle,
        duration: 6,
      });
    }
    return '';
  }, [mode, publicId, bgImagePublicId, title, subtitle, cloudName]);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex gap-2">
        <Button
          variant={mode === 'fromImage' ? 'default' : 'outline'}
          onClick={() => setMode('fromImage')}
          disabled={!bgImagePublicId}
        >
          À partir d'une image
        </Button>
        <Button
          variant={mode === 'upload' ? 'default' : 'outline'}
          onClick={() => setMode('upload')}
        >
          Uploader une vidéo
        </Button>
      </div>

      {mode === 'upload' && (
        <div className="space-y-2">
          <Label htmlFor="video-file">Fichier vidéo</Label>
          <Input
            id="video-file"
            type="file"
            accept="video/*"
            onChange={onFile}
            disabled={uploading}
          />
          {uploading && <p className="text-sm text-muted-foreground">Upload en cours...</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="video-title">Titre</Label>
          <Input
            id="video-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="video-subtitle">Sous-titre</Label>
          <Input
            id="video-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Sous-titre"
          />
        </div>
      </div>

      {preview && (
        <div className="space-y-2">
          <Label>Prévisualisation</Label>
          <video
            src={preview}
            controls
            playsInline
            className="w-full max-w-[270px] mx-auto rounded border aspect-[9/16] object-cover"
          />
        </div>
      )}

      {!cloudName && (
        <div className="p-4 border border-destructive/50 rounded-lg bg-destructive/10">
          <p className="text-sm text-destructive font-medium">
            ⚠️ Configuration manquante
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            La variable d'environnement VITE_CLOUDINARY_CLOUD_NAME n'est pas configurée.
            Contactez l'administrateur.
          </p>
        </div>
      )}
    </div>
  );
}
