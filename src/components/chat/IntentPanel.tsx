/**
 * Phase 6: Intent Panel Component
 * Displays a summary of generated intents for user review before generation
 */

import { useState, useRef } from 'react';
import { Edit2, Trash2, ChevronDown, ChevronUp, Upload, Palette, Volume2, VolumeX } from 'lucide-react';
import type { UnifiedAlfieIntent, VisualStyle } from '@/lib/types/alfie';
import { getWoofCost } from '@/types/alfiePack';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VISUAL_STYLE_OPTIONS: { value: VisualStyle; label: string }[] = [
  { value: "photorealistic", label: "📷 Photoréaliste" },
  { value: "cinematic_photorealistic", label: "🎬 Cinématique" },
  { value: "3d_pixar_style", label: "🎨 3D Pixar" },
  { value: "flat_illustration", label: "✏️ Illustration flat" },
  { value: "minimalist_vector", label: "⚪ Minimaliste" },
  { value: "digital_painting", label: "🖌️ Peinture digitale" },
  { value: "comic_book", label: "💥 Comic book" },
];

interface IntentPanelProps {
  intents: UnifiedAlfieIntent[];
  onConfirm: (selectedIds: string[], options: { useBrandKit: boolean; withAudio: boolean }) => Promise<void>;
  onEdit: (intent: UnifiedAlfieIntent) => void;
  onRemove: (intentId: string) => void;
  onClose: () => void;
  onUpdateIntent?: (intentId: string, updates: Partial<UnifiedAlfieIntent>) => void;
  isLoading?: boolean;
}

export function IntentPanel({
  intents,
  onConfirm,
  onEdit,
  onRemove,
  onClose,
  onUpdateIntent,
  isLoading,
}: IntentPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(intents.map((i) => i.id))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [uploadingForId, setUploadingForId] = useState<string | null>(null);
  const [useBrandKit, setUseBrandKit] = useState(true);
  const [withAudio, setWithAudio] = useState(true);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalWoofs = intents
    .filter((i) => selectedIds.has(i.id))
    .reduce((sum, i) => sum + getWoofCost(i), 0);

  const hasVideoIntents = intents.some(i => i.kind === 'video_premium');

  const handleConfirm = async () => {
    const selectedIntents = intents.filter(i => selectedIds.has(i.id));
    const videosWithoutImage = selectedIntents.filter(
      i => i.kind === 'video_premium' && !i.referenceImageUrl
    );
    
    // ✅ Recommandé mais pas bloquant
    if (videosWithoutImage.length > 0) {
      toast.warning(`📸 Recommandé : ajoute une image source pour de meilleurs résultats (${videosWithoutImage.map(v => v.title).join(', ')})`);
    }
    
    await onConfirm(Array.from(selectedIds), { useBrandKit, withAudio });
  };

  const handleImageUpload = async (intentId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Seules les images sont acceptées');
      return;
    }

    setUploadingForId(intentId);
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `video-refs/${intentId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(filePath);

      if (onUpdateIntent) {
        onUpdateIntent(intentId, { referenceImageUrl: publicUrl });
      }
      
      toast.success('Image ajoutée');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploadingForId(null);
    }
  };

  const handleStyleChange = (intentId: string, style: VisualStyle) => {
    if (onUpdateIntent) {
      onUpdateIntent(intentId, { visualStyle: style });
    }
  };

  const isVideoIntent = (kind: string) => kind === 'video_premium' || kind === 'video_basic';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-2xl h-[92vh] sm:h-auto sm:max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Récapitulatif de ta commande</h2>
          <p className="text-sm text-muted-foreground">
            {intents.length} asset(s) · {totalWoofs} Woofs au total
          </p>
        </div>

        {/* Global options */}
        <div className="px-4 py-3 border-b bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="useBrandKit" className="text-sm font-medium">
                Utiliser le Brand Kit
              </Label>
            </div>
            <Switch
              id="useBrandKit"
              checked={useBrandKit}
              onCheckedChange={setUseBrandKit}
            />
          </div>
          {!useBrandKit && (
            <p className="text-xs text-muted-foreground pl-6">
              Les visuels seront générés avec un style neutre et professionnel.
            </p>
          )}

          {hasVideoIntents && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {withAudio ? <Volume2 className="w-4 h-4 text-muted-foreground" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                <Label htmlFor="withAudio" className="text-sm font-medium">
                  Générer avec audio
                </Label>
              </div>
              <Switch
                id="withAudio"
                checked={withAudio}
                onCheckedChange={setWithAudio}
              />
            </div>
          )}
        </div>

        {/* Liste des intents */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {intents.map((intent) => (
            <div
              key={intent.id}
              className={`border rounded-lg p-3 transition-all ${
                selectedIds.has(intent.id)
                  ? 'border-primary bg-primary/5'
                  : 'opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(intent.id)}
                  onChange={() => toggleSelect(intent.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{intent.title}</span>
                    <Badge variant="outline">{intent.kind}</Badge>
                    <Badge variant="secondary">{intent.platform}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {intent.prompt}
                  </p>

                  {/* Style selector */}
                  <div className="mt-2">
                    <Select
                      value={intent.visualStyle || "photorealistic"}
                      onValueChange={(value) => handleStyleChange(intent.id, value as VisualStyle)}
                    >
                      <SelectTrigger className="h-8 text-xs w-48">
                        <SelectValue placeholder="Style visuel" />
                      </SelectTrigger>
                      <SelectContent>
                        {VISUAL_STYLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Video script - PROMINENT display */}
                  {isVideoIntent(intent.kind) && intent.generatedTexts?.video && (
                    <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="font-medium text-sm mb-2 text-purple-700 dark:text-purple-300">
                        🎬 Script vidéo
                      </div>
                      {intent.generatedTexts.video.hook && (
                        <div className="text-sm mb-1">
                          <span className="font-medium text-purple-600 dark:text-purple-400">Hook:</span>{' '}
                          <span className="text-foreground">{intent.generatedTexts.video.hook}</span>
                        </div>
                      )}
                      {intent.generatedTexts.video.script && (
                        <div className="text-sm mb-1">
                          <span className="font-medium text-purple-600 dark:text-purple-400">Script:</span>{' '}
                          <span className="text-foreground">{intent.generatedTexts.video.script}</span>
                        </div>
                      )}
                      {intent.generatedTexts.video.cta && (
                        <div className="text-sm">
                          <span className="font-medium text-purple-600 dark:text-purple-400">CTA:</span>{' '}
                          <span className="text-foreground">{intent.generatedTexts.video.cta}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload image pour vidéos */}
                  {isVideoIntent(intent.kind) && (
                    <div className="mt-2">
                      {intent.referenceImageUrl ? (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                          <img 
                            src={intent.referenceImageUrl} 
                            alt="Image source" 
                            className="w-12 h-12 object-cover rounded"
                          />
                          <span className="text-xs text-muted-foreground flex-1">Image source ajoutée</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRefs.current[intent.id]?.click()}
                          >
                            Changer
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRefs.current[intent.id]?.click()}
                          disabled={uploadingForId === intent.id}
                          className="flex items-center gap-2 p-2 border border-dashed border-orange-400 rounded bg-orange-50 dark:bg-orange-950/20 text-orange-600 text-xs hover:bg-orange-100 dark:hover:bg-orange-950/40 transition w-full"
                        >
                          {uploadingForId === intent.id ? (
                            <span>Upload en cours...</span>
                          ) : (
                          <>
                              <Upload className="w-4 h-4" />
                              <span>📸 Ajoute une image source (recommandé)</span>
                            </>
                          )}
                        </button>
                      )}
                      <input
                        ref={(el) => { fileInputRefs.current[intent.id] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(intent.id, file);
                        }}
                      />
                    </div>
                  )}

                  {/* Expanded details for non-video */}
                  {expanded.has(intent.id) && intent.generatedTexts && !isVideoIntent(intent.kind) && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-2">
                      {intent.generatedTexts.text && (
                        <div>
                          <strong>{intent.generatedTexts.text.title}</strong>
                          <p>{intent.generatedTexts.text.body}</p>
                        </div>
                      )}
                      {intent.generatedTexts.slides && (
                        <div>
                          {intent.generatedTexts.slides.map((s, i) => (
                            <div key={i}><strong>Slide {i+1}:</strong> {s.title}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-medium">{getWoofCost(intent)} Woofs</span>
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(intent)} className="p-1 hover:bg-muted rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onRemove(intent.id)} className="p-1 hover:bg-muted rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {!isVideoIntent(intent.kind) && intent.generatedTexts && (
                      <button
                        onClick={() => setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(intent.id)) next.delete(intent.id);
                          else next.add(intent.id);
                          return next;
                        })}
                        className="p-1 hover:bg-muted rounded"
                      >
                        {expanded.has(intent.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 safe-bottom">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            disabled={isLoading}
            className="order-2 sm:order-1 touch-target"
          >
            Annuler
          </Button>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 order-1 sm:order-2">
            <span className="font-bold text-center sm:text-left">{totalWoofs} Woofs</span>
            <Button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0 || isLoading}
              className="touch-target"
            >
              {isLoading ? 'Génération...' : `Lancer (${selectedIds.size} assets)`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
