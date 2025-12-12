import { motion, AnimatePresence } from 'framer-motion';
import { X, Backpack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { Intent } from '@/lib/types/startFlow';

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  intent: Intent;
  onUpdate: (updates: Partial<Intent>) => void;
}

export function InventoryDrawer({ isOpen, onClose, intent, onUpdate }: InventoryDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Backpack className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Inventaire</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Ratio */}
              <div>
                <Label className="text-sm font-medium mb-3 block">📐 Format</Label>
                <div className="flex gap-2">
                  {(['4:5', '1:1', '9:16'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => onUpdate({ ratio })}
                      className={`
                        flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all
                        ${intent.ratio === ratio
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }
                      `}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slides */}
              {(intent.kind === 'pack' || intent.kind === 'carousel') && (
                <div>
                  <Label className="text-sm font-medium mb-3 flex items-center justify-between">
                    <span>📚 Slides</span>
                    <span className="text-primary font-bold">{intent.slides}</span>
                  </Label>
                  <Slider
                    value={[intent.slides]}
                    onValueChange={([val]) => onUpdate({ slides: val })}
                    min={3}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}

              {/* Tone */}
              <div>
                <Label className="text-sm font-medium mb-3 block">🎭 Ton</Label>
                <div className="flex flex-wrap gap-2">
                  {(['Fun', 'Pro', 'Luxe', 'Cute'] as const).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => onUpdate({ tone })}
                      className={`
                        px-4 py-2 rounded-xl text-sm font-medium transition-all
                        ${intent.tone === tone
                          ? 'bg-alfie-pink text-foreground shadow-md'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }
                      `}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              {/* Density */}
              <div>
                <Label className="text-sm font-medium mb-3 block">📊 Densité</Label>
                <div className="flex gap-2">
                  {(['airy', 'balanced', 'compact'] as const).map((density) => (
                    <button
                      key={density}
                      onClick={() => onUpdate({ density })}
                      className={`
                        flex-1 py-2 px-3 rounded-xl text-sm font-medium capitalize transition-all
                        ${intent.density === density
                          ? 'bg-alfie-lilac text-foreground shadow-md'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }
                      `}
                    >
                      {density === 'airy' ? '🌬️ Aéré' : density === 'balanced' ? '⚖️ Équilibré' : '📦 Compact'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Locks */}
              <div>
                <Label className="text-sm font-medium mb-3 block">🔒 Brand Kit</Label>
                <div className="space-y-3 bg-muted/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">🎨 Palette</span>
                    <Switch
                      checked={intent.brandLocks.palette}
                      onCheckedChange={(checked) =>
                        onUpdate({ brandLocks: { ...intent.brandLocks, palette: checked } })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">🔤 Typos</span>
                    <Switch
                      checked={intent.brandLocks.fonts}
                      onCheckedChange={(checked) =>
                        onUpdate({ brandLocks: { ...intent.brandLocks, fonts: checked } })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">🏷️ Logo</span>
                    <Switch
                      checked={intent.brandLocks.logo}
                      onCheckedChange={(checked) =>
                        onUpdate({ brandLocks: { ...intent.brandLocks, logo: checked } })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
