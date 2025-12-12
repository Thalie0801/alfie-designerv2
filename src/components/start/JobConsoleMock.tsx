import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const STEPS = [
  { id: 1, label: "J'écris les hooks", duration: 1500 },
  { id: 2, label: "Je structure les slides", duration: 1800 },
  { id: 3, label: "Je compose le design", duration: 2000 },
  { id: 4, label: "Je prépare les fichiers", duration: 1500 },
  { id: 5, label: "Dernière vérif ✨", duration: 1200 },
];

interface JobConsoleMockProps {
  onComplete: () => void;
}

export function JobConsoleMock({ onComplete }: JobConsoleMockProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let stepIndex = 0;
    let progressValue = 0;

    const advanceStep = () => {
      if (stepIndex < STEPS.length) {
        setCurrentStep(stepIndex + 1);
        stepIndex++;

        // Update progress
        const targetProgress = (stepIndex / STEPS.length) * 100;
        const progressInterval = setInterval(() => {
          progressValue += 2;
          if (progressValue >= targetProgress) {
            progressValue = targetProgress;
            clearInterval(progressInterval);
          }
          setProgress(progressValue);
        }, 50);

        if (stepIndex < STEPS.length) {
          setTimeout(advanceStep, STEPS[stepIndex - 1].duration);
        } else {
          setTimeout(() => {
            setProgress(100);
            setTimeout(onComplete, 800);
          }, STEPS[stepIndex - 1].duration);
        }
      }
    };

    // Start after a short delay
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
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #E3FBF9 0%, #FFE4EC 25%, #E8D5FF 50%, #FFD4B8 75%, #FFF9C4 100%)',
      }}
    >
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl"
        >
          {/* Animated Dog */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl text-center mb-6"
          >
            🐕
          </motion.div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-foreground mb-2">
            Alfie bosse. Toi, tu respires.
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Génération en cours...
          </p>

          {/* Progress Bar */}
          <div className="mb-8">
            <Progress value={progress} className="h-3 rounded-full" />
            <p className="text-center text-sm text-muted-foreground mt-2">
              {Math.round(progress)}%
            </p>
          </div>

          {/* Steps Timeline */}
          <div className="space-y-4">
            {STEPS.map((step, index) => {
              const isComplete = currentStep > index;
              const isCurrent = currentStep === index + 1;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isComplete
                      ? 'bg-alfie-mintSoft'
                      : isCurrent
                      ? 'bg-alfie-lilac/20'
                      : 'bg-muted/30'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isComplete
                        ? 'bg-alfie-mint text-white'
                        : isCurrent
                        ? 'bg-alfie-lilac text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isComplete ? (
                      <Check className="w-4 h-4" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="text-sm">{step.id}</span>
                    )}
                  </div>
                  <span
                    className={`font-medium ${
                      isComplete || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
