/**
 * Phase 6: Intent Panel Component
 * Displays a summary of generated intents for user review before generation
 */

import { useState } from 'react';
import { Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { UnifiedAlfieIntent } from '@/lib/types/alfie';
import { getWoofCost } from '@/types/alfiePack';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface IntentPanelProps {
  intents: UnifiedAlfieIntent[];
  onConfirm: (selectedIds: string[]) => Promise<void>;
  onEdit: (intent: UnifiedAlfieIntent) => void;
  onRemove: (intentId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function IntentPanel({
  intents,
  onConfirm,
  onEdit,
  onRemove,
  onClose,
  isLoading,
}: IntentPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(intents.map((i) => i.id))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
    await onConfirm(Array.from(selectedIds));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
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
                  {expanded.has(intent.id) && intent.generatedTexts && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
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
        <div className="p-4 border-t flex items-center justify-between">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <div className="flex items-center gap-4">
            <span className="font-bold">{totalWoofs} Woofs</span>
            <Button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0 || isLoading}
            >
              {isLoading ? 'Génération...' : `Lancer (${selectedIds.size} assets)`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
