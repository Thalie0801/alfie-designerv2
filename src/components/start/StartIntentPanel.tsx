import { motion } from 'framer-motion';
import { Sparkles, Package, LayoutGrid, Square, Smartphone, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Intent } from '@/pages/Start';

const KIND_ICONS: Record<Intent['kind'], React.ElementType> = {
  pack: Package,
  carousel: LayoutGrid,
  post: Square,
  story: Smartphone,
  thumbnail: Image,
};

const KIND_LABELS: Record<Intent['kind'], string> = {
  pack: 'Pack Express',
  carousel: 'Carrousel',
  post: 'Post',
  story: 'Story',
  thumbnail: 'Thumbnail',
};

const WOOFS_COST: Record<Intent['kind'], number> = {
  pack: 3,
  carousel: 3,
  post: 1,
  story: 1,
  thumbnail: 1,
};

interface StartIntentPanelProps {
  intent: Intent;
  onUpdate: (updates: Partial<Intent>) => void;
  onGenerate: () => void;
}

export function StartIntentPanel({ intent, onUpdate, onGenerate }: StartIntentPanelProps) {
  const Icon = KIND_ICONS[intent.kind];
  const woofsCost = WOOFS_COST[intent.kind];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #E3FBF9 0%, #FFE4EC 25%, #E8D5FF 50%, #FFD4B8 75%, #FFF9C4 100%)',
      }}
    >
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-6">
        {/* Left: Summary */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl"
        >
          <h2 className="text-2xl font-bold text-foreground mb-6">
            OK. Prêt à générer ?
          </h2>

          <div className="space-y-4">
            {/* Format */}
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-2xl">
              <div className="w-12 h-12 bg-gradient-to-br from-alfie-mint to-alfie-lilac rounded-xl flex items-center justify-center">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{KIND_LABELS[intent.kind]}</p>
                {intent.slides > 1 && (
                  <p className="text-sm text-muted-foreground">{intent.slides} slides</p>
                )}
              </div>
            </div>

            {/* Topic */}
            <div className="p-4 bg-muted/50 rounded-2xl">
              <p className="text-sm text-muted-foreground mb-1">Sujet</p>
              <p className="font-medium text-foreground">{intent.topic}</p>
            </div>

            {/* Goal + CTA */}
            <div className="flex gap-3">
              <div className="flex-1 p-4 bg-muted/50 rounded-2xl">
                <p className="text-sm text-muted-foreground mb-1">Objectif</p>
                <p className="font-medium text-foreground">{intent.goal}</p>
              </div>
              <div className="flex-1 p-4 bg-muted/50 rounded-2xl">
                <p className="text-sm text-muted-foreground mb-1">CTA</p>
                <p className="font-medium text-foreground">{intent.cta}</p>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <div className="mt-8 space-y-3">
            <Button
              onClick={onGenerate}
              size="lg"
              className="w-full h-14 text-lg rounded-xl bg-gradient-to-r from-alfie-mint via-alfie-pink to-alfie-lilac text-foreground font-semibold hover:opacity-90"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Générer maintenant
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Coût : {woofsCost} Woofs • Livraison : Canva + ZIP
            </p>
          </div>
        </motion.div>

        {/* Right: Editable Options */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl"
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Options avancées
          </h3>

          <Accordion type="single" collapsible className="space-y-2">
            {/* Ratio */}
            <AccordionItem value="ratio" className="border rounded-xl px-4">
              <AccordionTrigger className="hover:no-underline">
                <span>Format : {intent.ratio}</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex gap-2 pb-4">
                  {(['4:5', '1:1', '9:16'] as const).map((ratio) => (
                    <Button
                      key={ratio}
                      variant={intent.ratio === ratio ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onUpdate({ ratio })}
                      className={`flex-1 rounded-lg ${
                        intent.ratio === ratio ? 'bg-alfie-mint text-foreground' : ''
                      }`}
                    >
                      {ratio}
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Slides (if applicable) */}
            {(intent.kind === 'pack' || intent.kind === 'carousel') && (
              <AccordionItem value="slides" className="border rounded-xl px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span>Slides : {intent.slides}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pb-4">
                    <Slider
                      value={[intent.slides]}
                      onValueChange={([val]) => onUpdate({ slides: val })}
                      min={3}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>3</span>
                      <span>10</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Tone */}
            <AccordionItem value="tone" className="border rounded-xl px-4">
              <AccordionTrigger className="hover:no-underline">
                <span>Ton : {intent.tone}</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2 pb-4">
                  {(['Fun', 'Pro', 'Luxe', 'Cute'] as const).map((tone) => (
                    <Button
                      key={tone}
                      variant={intent.tone === tone ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onUpdate({ tone })}
                      className={`rounded-lg ${
                        intent.tone === tone ? 'bg-alfie-pink text-foreground' : ''
                      }`}
                    >
                      {tone}
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Density */}
            <AccordionItem value="density" className="border rounded-xl px-4">
              <AccordionTrigger className="hover:no-underline">
                <span>Densité : {intent.density}</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex gap-2 pb-4">
                  {(['airy', 'balanced', 'compact'] as const).map((density) => (
                    <Button
                      key={density}
                      variant={intent.density === density ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onUpdate({ density })}
                      className={`flex-1 rounded-lg capitalize ${
                        intent.density === density ? 'bg-alfie-lilac text-foreground' : ''
                      }`}
                    >
                      {density}
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Brand Locks */}
            <AccordionItem value="brand" className="border rounded-xl px-4">
              <AccordionTrigger className="hover:no-underline">
                <span>Brand Kit</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lock-palette">Palette</Label>
                    <Switch
                      id="lock-palette"
                      checked={intent.brandLocks.palette}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          brandLocks: { ...intent.brandLocks, palette: checked },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lock-fonts">Typos</Label>
                    <Switch
                      id="lock-fonts"
                      checked={intent.brandLocks.fonts}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          brandLocks: { ...intent.brandLocks, fonts: checked },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lock-logo">Logo</Label>
                    <Switch
                      id="lock-logo"
                      checked={intent.brandLocks.logo}
                      onCheckedChange={(checked) =>
                        onUpdate({
                          brandLocks: { ...intent.brandLocks, logo: checked },
                        })
                      }
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>
      </div>
    </motion.div>
  );
}
