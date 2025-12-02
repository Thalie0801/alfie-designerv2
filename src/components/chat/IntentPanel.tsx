/**
 * Phase 6: Intent Panel Component
 * Displays a summary of generated intents for user review before generation
 */

import { useState, useRef } from 'react';
import { Edit2, Trash2, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import type { UnifiedAlfieIntent } from '@/lib/types/alfie';
import { getWoofCost } from '@/types/alfiePack';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IntentPanelProps {
  intents: UnifiedAlfieIntent[];
  onConfirm: (selectedIds: string[]) => Promise<void>;
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

  const handleConfirm = async () => {
    // Vérifier que les vidéos ont une image
    const selectedIntents = intents.filter(i => selectedIds.has(i.id));
    const videosWithoutImage = selectedIntents.filter(
      i => i.kind === 'video_premium' && !i.referenceImageUrl
    );
    
    if (videosWithoutImage.length > 0) {
      toast.error(`📸 Ajoute une image source pour tes vidéos : ${videosWithoutImage.map(v => v.title).join(', ')}`);
      return;
    }
    
    await onConfirm(Array.from(selectedIds));
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{intent.title}</span>
                    <Badge variant="outline">{intent.kind}</Badge>
                    <Badge variant="secondary">{intent.platform}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {intent.prompt}
                  </p>

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
                              <span>📸 Ajoute une image source (obligatoire)</span>
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

                  {expanded.has(intent.id) && intent.generatedTexts && (
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
                      {/* Afficher le script vidéo */}
                      {intent.generatedTexts.video && (
                        <div className="border-t pt-2 mt-2">
                          <strong>🎬 Script vidéo :</strong>
                          {intent.generatedTexts.video.hook && (
                            <p><span className="text-muted-foreground">Hook:</span> {intent.generatedTexts.video.hook}</p>
                          )}
                          {intent.generatedTexts.video.script && (
                            <p><span className="text-muted-foreground">Script:</span> {intent.generatedTexts.video.script}</p>
                          )}
                          {intent.generatedTexts.video.cta && (
                            <p><span className="text-muted-foreground">CTA:</span> {intent.generatedTexts.video.cta}</p>
                          )}
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