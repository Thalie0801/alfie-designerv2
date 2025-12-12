import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { ParticleField } from '../game/ParticleField';

const CRAFTING_STEPS = [
  { id: 1, label: '🔥 Forge les hooks', duration: 1500 },
  { id: 2, label: '🔨 Assemble les slides', duration: 1800 },
  { id: 3, label: '✨ Poli le design', duration: 2000 },
  { id: 4, label: '📦 Emballe le loot', duration: 1500 },
  { id: 5, label: '🔍 Loot check', duration: 1200 },
];

interface CraftingSceneProps {
  onComplete: () => void;
}

export function CraftingScene({ onComplete }: CraftingSceneProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    let stepIndex = 0;
    let progressValue = 0;

    const advanceStep = () => {
      if (stepIndex < CRAFTING_STEPS.length) {
        setCurrentStep(stepIndex + 1);
        stepIndex++;

        const targetProgress = (stepIndex / CRAFTING_STEPS.length) * 100;
        const progressInterval = setInterval(() => {
          progressValue += 2;
          if (progressValue >= targetProgress) {
            progressValue = targetProgress;
            clearInterval(progressInterval);
          }
          setProgress(progressValue);
        }, 50);

        if (stepIndex < CRAFTING_STEPS.length) {
          setTimeout(advanceStep, CRAFTING_STEPS[stepIndex - 1].duration);
        } else {
          setTimeout(() => {
            setProgress(100);
            setTimeout(onComplete, 800);
          }, CRAFTING_STEPS[stepIndex - 1].duration);
        }
      }
    };

    const startTimeout = setTimeout(() => {
      advanceStep();
    }, 500);

    return () => {
      clearTimeout(startTimeout);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen w-full flex items-center justify-center p-4 relative"
    >
      {/* Fast particles during crafting */}
      <ParticleField count={40} speed="fast" />

      <div className="max-w-md w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-background/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-border/50"
        >
          {/* Animated Anvil/Forge */}
          <motion.div
            className="text-6xl text-center mb-6"
            animate={
              !prefersReducedMotion
                ? {
                    y: [0, -10, 0],
                    rotate: [0, -5, 5, 0],
                  }
                : {}
            }
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            ⚒️
          </motion.div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-foreground mb-2">
            Alfie forge ton pack...
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Quelques secondes et c'est prêt !
          </p>

          {/* Crafting Progress Bar */}
          <div className="mb-8">
            <div className="h-4 bg-muted rounded-full overflow-hidden relative">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, hsl(var(--alfie-mint)), hsl(var(--alfie-pink)), hsl(var(--alfie-lilac)), hsl(var(--alfie-peach)))',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
              {/* Sparks on progress bar */}
              {!prefersReducedMotion && (
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 text-lg"
                  style={{ left: `${progress}%` }}
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.3, repeat: Infinity }}
                >
                  ✨
                </motion.div>
              )}
            </div>
            <p className="text-center text-sm font-bold text-foreground mt-2">
              {Math.round(progress)}%
            </p>
          </div>

          {/* Crafting Steps */}
          <div className="space-y-3">
            {CRAFTING_STEPS.map((step, index) => {
              const isComplete = currentStep > index;
              const isCurrent = currentStep === index + 1;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl transition-all
                    ${isComplete
                      ? 'bg-alfie-mintSoft'
                      : isCurrent
                      ? 'bg-gradient-to-r from-alfie-lilac/30 to-alfie-pink/30'
                      : 'bg-muted/30'
                    }
                  `}
                >
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                      ${isComplete
                        ? 'bg-alfie-mint text-white'
                        : isCurrent
                        ? 'bg-gradient-to-br from-alfie-lilac to-alfie-pink text-white'
                        : 'bg-muted text-muted-foreground'
                      }
                    `}
                  >
                    {isComplete ? (
                      <Check className="w-5 h-5" />
                    ) : isCurrent ? (
                      <motion.div
                        animate={!prefersReducedMotion ? { rotate: 360 } : {}}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      >
                        <Loader2 className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      step.id
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      isComplete || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>

                  {/* Completion spark */}
                  {isComplete && !prefersReducedMotion && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="ml-auto text-lg"
                    >
                      ✅
                    </motion.span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
