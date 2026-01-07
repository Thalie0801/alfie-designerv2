import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Loader2, Upload, X, User, Dog, Package, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useSubjectPacks } from '@/hooks/useSubjectPacks';
import { useBrandKit } from '@/hooks/useBrandKit';

interface SubjectPackCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (packId: string) => void;
}

type PackType = 'person' | 'mascot' | 'product' | 'object';

const PACK_TYPES: { value: PackType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'person', label: 'Personnage', icon: <User className="h-5 w-5" />, description: 'Personne ou avatar humain' },
  { value: 'mascot', label: 'Mascotte', icon: <Dog className="h-5 w-5" />, description: 'Personnage de marque' },
  { value: 'product', label: 'Produit', icon: <Package className="h-5 w-5" />, description: 'Produit physique à showcaser' },
  { value: 'object', label: 'Objet', icon: <Sparkles className="h-5 w-5" />, description: 'Élément graphique récurrent' },
];

interface ImageSlot {
  file: File | null;
  preview: string | null;
}

export function SubjectPackCreateModal({ open, onOpenChange, onCreated }: SubjectPackCreateModalProps) {
  const { createPack } = useSubjectPacks();
  const { brandKit } = useBrandKit();
  
  const [name, setName] = useState('');
  const [packType, setPackType] = useState<PackType>('person');
  const [identityPrompt, setIdentityPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  
  const [masterSlot, setMasterSlot] = useState<ImageSlot>({ file: null, preview: null });
  const [anchorASlot, setAnchorASlot] = useState<ImageSlot>({ file: null, preview: null });
  const [anchorBSlot, setAnchorBSlot] = useState<ImageSlot>({ file: null, preview: null });

  const handleFileDrop = useCallback((slot: 'master' | 'anchorA' | 'anchorB') => (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seules les images sont acceptées');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Le fichier est trop lourd (max 5 Mo)');
      return;
    }

    const preview = URL.createObjectURL(file);
    const newSlot = { file, preview };

    switch (slot) {
      case 'master':
        setMasterSlot(newSlot);
        break;
      case 'anchorA':
        setAnchorASlot(newSlot);
        break;
      case 'anchorB':
        setAnchorBSlot(newSlot);
        break;
    }
  }, []);

  const clearSlot = (slot: 'master' | 'anchorA' | 'anchorB') => {
    switch (slot) {
      case 'master':
        if (masterSlot.preview) URL.revokeObjectURL(masterSlot.preview);
        setMasterSlot({ file: null, preview: null });
        break;
      case 'anchorA':
        if (anchorASlot.preview) URL.revokeObjectURL(anchorASlot.preview);
        setAnchorASlot({ file: null, preview: null });
        break;
      case 'anchorB':
        if (anchorBSlot.preview) URL.revokeObjectURL(anchorBSlot.preview);
        setAnchorBSlot({ file: null, preview: null });
        break;
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Le nom du pack est requis');
      return;
    }

    if (!masterSlot.file) {
      toast.error('L\'image principale (Master) est requise');
      return;
    }

    setLoading(true);
    try {
      const result = await createPack(
        {
          name: name.trim(),
          pack_type: packType,
          identity_prompt: identityPrompt.trim(),
          negative_prompt: negativePrompt.trim(),
          brand_id: brandKit?.id,
        },
        {
          master: masterSlot.file,
          anchorA: anchorASlot.file || undefined,
          anchorB: anchorBSlot.file || undefined,
        },
        (status) => setUploadStatus(status)
      );

      // Show warnings for failed anchors
      if (result.warnings.length > 0) {
        result.warnings.forEach(w => toast.warning(w));
      }
      
      toast.success('Subject Pack créé !');
      onCreated?.(result.pack.id);
      
      // Reset form
      setName('');
      setPackType('person');
      setIdentityPrompt('');
      setNegativePrompt('');
      clearSlot('master');
      clearSlot('anchorA');
      clearSlot('anchorB');
      onOpenChange(false);
    } catch (err) {
      console.error('[SubjectPack] Error creating pack:', err);
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(`Erreur: ${message}`);
    } finally {
      setLoading(false);
      setUploadStatus(null);
    }
  };

  const ImageUploadSlot = ({ 
    slot, 
    slotData, 
    label, 
    required = false,
    description 
  }: { 
    slot: 'master' | 'anchorA' | 'anchorB'; 
    slotData: ImageSlot; 
    label: string; 
    required?: boolean;
    description: string;
  }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop: handleFileDrop(slot),
      accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
      maxFiles: 1,
      disabled: loading,
    });

    if (slotData.preview) {
      return (
        <div className="space-y-2">
          <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
          <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
            {imageLoading && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <img
              src={slotData.preview}
              alt={label}
              className={cn(
                "h-full w-full object-cover transition-opacity",
                imageLoading && "opacity-0"
              )}
              onLoad={() => {
                setImageLoading(false);
                setImageError(false);
              }}
              onError={(e) => {
                console.error('[SubjectPack] Image preview failed:', { slot, preview: slotData.preview });
                setImageLoading(false);
                setImageError(true);
                e.currentTarget.src = '/placeholder.svg';
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={() => clearSlot(slot)}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
        <div
          {...getRootProps()}
          className={cn(
            "aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors",
            isDragActive && "border-primary bg-primary/5",
            !isDragActive && "border-border hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground text-center px-2">{description}</p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau Subject Pack</DialogTitle>
          <DialogDescription>
            Crée un pack de références visuelles réutilisable pour tes contenus
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nom du pack *</Label>
            <Input
              id="name"
              placeholder="Ex: Sophie la coach"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Pack Type */}
          <div className="space-y-3">
            <Label>Type de subject</Label>
            <RadioGroup
              value={packType}
              onValueChange={(v) => setPackType(v as PackType)}
              className="grid grid-cols-2 gap-3"
              disabled={loading}
            >
              {PACK_TYPES.map((type) => (
                <Label
                  key={type.value}
                  htmlFor={type.value}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    packType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value={type.value} id={type.value} className="sr-only" />
                  <div className="text-primary">{type.icon}</div>
                  <div>
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Image Slots */}
          <div className="space-y-3">
            <Label>Images de référence (1-3)</Label>
            <div className="grid grid-cols-3 gap-3">
              <ImageUploadSlot
                slot="master"
                slotData={masterSlot}
                label="Master"
                required
                description="Image principale"
              />
              <ImageUploadSlot
                slot="anchorA"
                slotData={anchorASlot}
                label="Anchor A"
                description="Visage / Logo"
              />
              <ImageUploadSlot
                slot="anchorB"
                slotData={anchorBSlot}
                label="Anchor B"
                description="Corps / Contexte"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Seule l'image Master est obligatoire. Les anchors améliorent la cohérence visuelle.
            </p>
          </div>

          {/* Identity Prompt */}
          <div className="space-y-2">
            <Label htmlFor="identity">Description d'identité (optionnel)</Label>
            <Textarea
              id="identity"
              placeholder="Ex: Une femme trentenaire aux cheveux bruns, style décontracté mais professionnel..."
              value={identityPrompt}
              onChange={(e) => setIdentityPrompt(e.target.value)}
              rows={2}
              disabled={loading}
            />
          </div>

          {/* Negative Prompt */}
          <div className="space-y-2">
            <Label htmlFor="negative">À éviter (optionnel)</Label>
            <Textarea
              id="negative"
              placeholder="Ex: Lunettes, tatouages, couleurs vives..."
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
              disabled={loading}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim() || !masterSlot.file}>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{uploadStatus || 'Création...'}</span>
              </div>
            ) : (
              'Créer le pack'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
