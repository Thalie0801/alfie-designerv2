import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Lightbulb, Package, LayoutGrid, Square, Smartphone, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Intent } from '@/pages/Start';

const TOPIC_IDEAS = [
  "Je perds trop de temps sur Canva (et ça me saoule).",
  "3 erreurs qui tuent votre engagement Instagram.",
  "Comment j'ai doublé mes leads en 30 jours.",
  "Le secret des entrepreneurs qui réussissent.",
  "Pourquoi 90% des posts ne marchent pas.",
  "Ma méthode pour créer du contenu en 10 min.",
  "L'outil qui a changé ma productivité.",
  "Ce que personne ne vous dit sur le personal branding.",
  "Comment transformer vos followers en clients.",
  "Les 5 tendances 2025 à ne pas rater.",
];

const FORMAT_OPTIONS = [
  { kind: 'pack' as const, label: 'Pack Express', icon: Package, recommended: true, slides: 5, ratio: '4:5' as const },
  { kind: 'carousel' as const, label: 'Carrousel', icon: LayoutGrid, slides: 5, ratio: '4:5' as const },
  { kind: 'post' as const, label: 'Post', icon: Square, slides: 1, ratio: '1:1' as const },
  { kind: 'story' as const, label: 'Story', icon: Smartphone, slides: 1, ratio: '9:16' as const },
  { kind: 'thumbnail' as const, label: 'Thumbnail', icon: Image, slides: 1, ratio: '1:1' as const },
];

const GOAL_OPTIONS = ['Convertir', 'Éduquer', 'Autorité', 'Engagement', 'Story'] as const;
const CTA_OPTIONS = ['Commenter', 'DM', 'Lien bio', 'Télécharger', 'Prendre RDV'] as const;

interface QuickStartWizardProps {
  intent: Intent;
  onUpdate: (updates: Partial<Intent>) => void;
  onComplete: () => void;
}

export function QuickStartWizard({ intent, onUpdate, onComplete }: QuickStartWizardProps) {
  const [step, setStep] = useState(1);

  const handleFormatSelect = (format: typeof FORMAT_OPTIONS[0]) => {
    onUpdate({
      kind: format.kind,
      slides: format.slides,
      ratio: format.ratio,
    });
    setStep(2);
  };

  const handleRandomIdea = () => {
    const randomIdea = TOPIC_IDEAS[Math.floor(Math.random() * TOPIC_IDEAS.length)];
    onUpdate({ topic: randomIdea });
  };

  const canProceed = () => {
    if (step === 1) return true;
    if (step === 2) return intent.topic.trim().length > 0;
    if (step === 3) return true;
    return false;
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #E3FBF9 0%, #FFE4EC 25%, #E8D5FF 50%, #FFD4B8 75%, #FFF9C4 100%)',
      }}
    >
      <div className="max-w-2xl w-full">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground/80">Étape {step}/3</span>
            <span className="text-sm text-muted-foreground">
              {step === 1 && 'Format'}
              {step === 2 && 'Sujet'}
              {step === 3 && 'Objectif'}
            </span>
          </div>
          <div className="h-2 bg-white/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-alfie-mint to-alfie-pink rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Format */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl"
            >
              <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
                Qu'est-ce que tu veux générer ?
              </h2>
              <p className="text-muted-foreground text-center mb-8">
                Choisis ton format préféré
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {FORMAT_OPTIONS.map((format) => {
                  const Icon = format.icon;
                  const isSelected = intent.kind === format.kind;
                  return (
                    <motion.button
                      key={format.kind}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleFormatSelect(format)}
                      className={`relative p-6 rounded-2xl border-2 transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                        isSelected
                          ? 'border-alfie-mint bg-alfie-mintSoft'
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      {format.recommended && (
                        <span className="absolute -top-2 -right-2 bg-alfie-pink text-white text-xs px-2 py-1 rounded-full font-medium">
                          Reco
                        </span>
                      )}
                      <Icon className={`w-8 h-8 mb-3 ${isSelected ? 'text-alfie-mint' : 'text-muted-foreground'}`} />
                      <h3 className="font-semibold text-foreground">{format.label}</h3>
                      {format.slides > 1 && (
                        <p className="text-sm text-muted-foreground">{format.slides} slides</p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Step 2: Topic */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl"
            >
              <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
                C'est sur quoi ?
              </h2>
              <p className="text-muted-foreground text-center mb-8">
                Décris ton sujet en une phrase
              </p>

              <div className="space-y-4">
                <Input
                  value={intent.topic}
                  onChange={(e) => onUpdate({ topic: e.target.value })}
                  placeholder="Ex : Je perds trop de temps sur Canva (et ça me saoule)."
                  className="h-14 text-base rounded-xl border-2 focus:border-alfie-mint"
                  autoFocus
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRandomIdea}
                    className="rounded-full gap-2"
                  >
                    <Lightbulb className="w-4 h-4" />
                    Donne-moi 10 idées
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.querySelector('input')?.focus()}
                    className="rounded-full"
                  >
                    J'ai déjà un titre
                  </Button>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <Button variant="ghost" onClick={handleBack} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="gap-2 bg-gradient-to-r from-alfie-mint to-alfie-lilac text-foreground"
                >
                  Suivant
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Goal + CTA */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl"
            >
              <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
                Objectif + CTA
              </h2>
              <p className="text-muted-foreground text-center mb-8">
                Qu'est-ce que tu veux que ton audience fasse ?
              </p>

              <div className="space-y-6">
                {/* Goal */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    Objectif principal
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map((goal) => (
                      <Button
                        key={goal}
                        variant={intent.goal === goal ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onUpdate({ goal })}
                        className={`rounded-full ${
                          intent.goal === goal
                            ? 'bg-alfie-mint text-foreground hover:bg-alfie-mint/90'
                            : ''
                        }`}
                      >
                        {goal}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">
                    Call-to-action
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CTA_OPTIONS.map((cta) => (
                      <Button
                        key={cta}
                        variant={intent.cta === cta ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onUpdate({ cta })}
                        className={`rounded-full ${
                          intent.cta === cta
                            ? 'bg-alfie-pink text-foreground hover:bg-alfie-pink/90'
                            : ''
                        }`}
                      >
                        {cta}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <Button variant="ghost" onClick={handleBack} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </Button>
                <Button
                  onClick={handleNext}
                  className="gap-2 bg-gradient-to-r from-alfie-mint to-alfie-pink text-foreground"
                >
                  <Sparkles className="w-4 h-4" />
                  Continuer
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
