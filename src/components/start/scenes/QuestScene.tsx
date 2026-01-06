import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Wand2, Lightbulb, Smartphone, TrendingUp, Backpack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LootCard } from '../ui/LootCard';
import { CraftingPreview } from '../ui/CraftingPreview';
import { InventoryDrawer } from '../ui/InventoryDrawer';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Intent, PackMode } from '@/lib/types/startFlow';

const TOPIC_IDEAS = [
  "Je perds trop de temps sur Canva (et ça me saoule).",
  "3 erreurs qui tuent votre engagement Instagram.",
  "Comment j'ai doublé mes leads en 30 jours.",
  "Le secret des entrepreneurs qui réussissent.",
  "Pourquoi 90% des posts ne marchent pas.",
];

const PACK_MODE_OPTIONS = [
  { 
    mode: 'social' as PackMode, 
    label: 'Pack Réseaux', 
    subtitle: '3 visuels prêts à poster',
    emoji: '📱',
    description: 'Contenu Instagram, LinkedIn...',
    icon: Smartphone,
  },
  { 
    mode: 'conversion' as PackMode, 
    label: 'Pack Conversion', 
    subtitle: '3 visuels qui vendent',
    emoji: '💰',
    description: 'Bénéfice → Preuve → Offre',
    icon: TrendingUp,
  },
];

const GOAL_OPTIONS = [
  { value: 'Convertir' as const, emoji: '💰', label: 'Convertir' },
  { value: 'Éduquer' as const, emoji: '📚', label: 'Éduquer' },
  { value: 'Autorité' as const, emoji: '👑', label: 'Autorité' },
  { value: 'Engagement' as const, emoji: '💬', label: 'Engagement' },
  { value: 'Story' as const, emoji: '📖', label: 'Story' },
];

const CTA_OPTIONS = [
  { value: 'Commenter' as const, emoji: '💬', label: 'Commenter' },
  { value: 'DM' as const, emoji: '✉️', label: 'Envoie DM' },
  { value: 'Lien bio' as const, emoji: '🔗', label: 'Lien bio' },
  { value: 'Télécharger' as const, emoji: '📥', label: 'Télécharger' },
  { value: 'Prendre RDV' as const, emoji: '📅', label: 'Prendre RDV' },
];

interface QuestSceneProps {
  intent: Intent;
  onUpdate: (updates: Partial<Intent>) => void;
  onComplete: () => void;
}

export function QuestScene({ intent, onUpdate, onComplete }: QuestSceneProps) {
  const [step, setStep] = useState(0);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const handlePackModeSelect = (mode: PackMode) => {
    onUpdate({ packMode: mode, kind: 'pack', slides: 3, ratio: '4:5' });
    setStep(1);
  };

  const handleRandomIdea = () => {
    const randomIdea = TOPIC_IDEAS[Math.floor(Math.random() * TOPIC_IDEAS.length)];
    onUpdate({ topic: randomIdea });
  };

  const canProceed = () => {
    if (step === 1) return (intent.brandName ?? '').trim().length > 0;
    if (step === 2) return (intent.topic ?? '').trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const totalSteps = 4;

  return (
    <div className="min-h-screen w-full flex">
      {/* Main Content */}
      <div className={`flex-1 flex flex-col items-center justify-center p-4 ${!isMobile ? 'pr-80' : ''}`}>
        <div className="max-w-2xl w-full">
          {/* Welcome Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
              Obtiens tes 3 visuels gratuits ✨
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              4 questions rapides → 3 formats prêts à poster
            </p>
          </motion.div>

          {/* Quest Progress */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-sm mx-auto block text-center">
              <span className="text-lg">⚔️</span>
              <span className="font-bold text-foreground">Niveau {step + 1}/{totalSteps}</span>
            </div>
            
            {/* XP Bar */}
            <div className="max-w-xs mx-auto mt-3">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, hsl(var(--alfie-mint)), hsl(var(--alfie-pink)), hsl(var(--alfie-lilac)))',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {/* Step 0: Pack Mode Selection */}
            {step === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="bg-background/90 backdrop-blur-md rounded-3xl p-4 sm:p-8 shadow-2xl border border-border/50"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 text-center">
                  🎯 Tu veux créer quoi ?
                </h2>
                <p className="text-muted-foreground text-center mb-6 text-sm sm:text-base">
                  Choisis le type de pack adapté à ton objectif
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PACK_MODE_OPTIONS.map((option) => (
                    <LootCard
                      key={option.mode}
                      icon={option.icon}
                      title={option.label}
                      subtitle={option.subtitle}
                      rarity={option.mode === 'conversion' ? 'epic' : 'rare'}
                      isSelected={intent.packMode === option.mode}
                      onClick={() => handlePackModeSelect(option.mode)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 1: Brand Name */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="bg-background/90 backdrop-blur-md rounded-3xl p-4 sm:p-8 shadow-2xl border border-border/50"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 text-center">
                  👋 C'est quoi ton business ?
                </h2>
                <p className="text-muted-foreground text-center mb-6 text-sm sm:text-base">
                  Donne-moi le nom de ta marque ou ton activité
                </p>

                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      value={intent.brandName}
                      onChange={(e) => onUpdate({ brandName: e.target.value })}
                      placeholder="Ex : Studio Léa, Coach Thomas, La Pâtisserie..."
                      className="h-14 text-base rounded-xl border-2 focus:border-primary pr-12 bg-background"
                      autoFocus
                    />
                    <motion.span
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xl"
                      animate={!prefersReducedMotion ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      🏷️
                    </motion.span>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={() => setStep(0)} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="gap-2 bg-gradient-to-r from-alfie-mint to-alfie-lilac text-foreground font-bold"
                  >
                    Suivant
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Topic (Cast Spell) */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="bg-background/90 backdrop-blur-md rounded-3xl p-4 sm:p-8 shadow-2xl border border-border/50"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 text-center">
                  🪄 Lance ton sort
                </h2>
                <p className="text-muted-foreground text-center mb-6 text-sm sm:text-base">
                  C'est quoi le sujet ?
                </p>

                <div className="space-y-4">
                  <div className="relative">
                    <Input
                      value={intent.topic}
                      onChange={(e) => onUpdate({ topic: e.target.value })}
                      placeholder="Ex : Je perds trop de temps sur Canva..."
                      className="h-14 text-base rounded-xl border-2 focus:border-primary pr-12 bg-background"
                      autoFocus
                    />
                    <motion.span
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xl"
                      animate={!prefersReducedMotion ? { rotate: [0, 10, -10, 0] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      ✨
                    </motion.span>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleRandomIdea}
                    className="rounded-xl gap-2 w-full sm:w-auto"
                  >
                    <Lightbulb className="w-4 h-4" />
                    🎲 Idée aléatoire
                  </Button>
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="gap-2 bg-gradient-to-r from-alfie-mint to-alfie-lilac text-foreground font-bold"
                  >
                    Suivant
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Goal + CTA (Skills) */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="bg-background/90 backdrop-blur-md rounded-3xl p-4 sm:p-8 shadow-2xl border border-border/50"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 text-center">
                  ⚡ Choisis tes skills
                </h2>
                <p className="text-muted-foreground text-center mb-6 text-sm sm:text-base">
                  Objectif + action finale
                </p>

                <div className="space-y-6">
                  {/* Goal */}
                  <div>
                    <label className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      🎯 Objectif
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {GOAL_OPTIONS.map((goal) => (
                        <button
                          key={goal.value}
                          onClick={() => onUpdate({ goal: goal.value })}
                          className={`
                            px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]
                            ${intent.goal === goal.value
                              ? 'bg-alfie-mint text-foreground shadow-lg scale-105'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }
                          `}
                        >
                          {goal.emoji} {goal.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div>
                    <label className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      🚀 Call-to-action
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CTA_OPTIONS.map((cta) => (
                        <button
                          key={cta.value}
                          onClick={() => onUpdate({ cta: cta.value })}
                          className={`
                            px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px]
                            ${intent.cta === cta.value
                              ? 'bg-alfie-pink text-foreground shadow-lg scale-105'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }
                          `}
                        >
                          {cta.emoji} {cta.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between mt-8">
                  <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="gap-2 bg-gradient-to-r from-alfie-mint via-alfie-pink to-alfie-lilac text-foreground font-bold"
                  >
                    <Wand2 className="w-4 h-4" />
                    Continuer
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Desktop: Crafting Preview */}
      {!isMobile && (
        <div className="fixed right-0 top-0 bottom-0 w-80 p-6 flex items-center justify-center bg-background/50 backdrop-blur-sm border-l border-border/50">
          <CraftingPreview intent={intent} />
        </div>
      )}

      {/* Mobile: Inventory Button */}
      {isMobile && (
        <Button
          onClick={() => setInventoryOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-xl bg-gradient-to-br from-alfie-mint to-alfie-lilac"
        >
          <Backpack className="w-6 h-6 text-white" />
        </Button>
      )}

      {/* Inventory Drawer */}
      <InventoryDrawer
        isOpen={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        intent={intent}
        onUpdate={onUpdate}
      />
    </div>
  );
}
