import { useEffect, useState, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Loader2, AlertCircle, Mail, Package, RefreshCw } from 'lucide-react';
import { ParticleField } from '../game/ParticleField';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Intent, GeneratedAsset } from '@/lib/types/startFlow';

const CRAFTING_STEPS_SOCIAL = [
  { id: 1, label: '🎨 Analyse de ton style', duration: 2000 },
  { id: 2, label: '📐 Post 1:1 en création...', duration: 2500 },
  { id: 3, label: '📱 Story 9:16 en cours...', duration: 2500 },
  { id: 4, label: '🖼️ Cover 4:5 presque prêt...', duration: 2000 },
  { id: 5, label: '✅ Pack finalisé !', duration: 1000 },
];

const CRAFTING_STEPS_CONVERSION = [
  { id: 1, label: '🎯 Analyse de ton offre', duration: 2000 },
  { id: 2, label: '💡 Visuel Bénéfice...', duration: 2500 },
  { id: 3, label: '🏆 Visuel Preuve...', duration: 2500 },
  { id: 4, label: '🚀 Visuel Offre + CTA...', duration: 2000 },
  { id: 5, label: '✅ Pack prêt à vendre !', duration: 1000 },
];

interface CraftingSceneProps {
  intent: Intent;
  email?: string;
  onComplete: (assets: GeneratedAsset[]) => void;
}

export function CraftingScene({ intent, email, onComplete }: CraftingSceneProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [resending, setResending] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const generationStarted = useRef(false);
  const animationComplete = useRef(false);
  const generatedAssets = useRef<GeneratedAsset[]>([]);

  const CRAFTING_STEPS = intent.packMode === 'conversion' 
    ? CRAFTING_STEPS_CONVERSION 
    : CRAFTING_STEPS_SOCIAL;

  // Start animation
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
            animationComplete.current = true;
            setIsComplete(true);
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
  }, [CRAFTING_STEPS]);

  // Start generation
  useEffect(() => {
    if (generationStarted.current) return;
    generationStarted.current = true;

    const generatePack = async () => {
      try {
        console.log('[CraftingScene] Starting generation with intent:', intent);

        // Get or create a temporary user/brand for the free pack
        const leadData = localStorage.getItem('alfie-start-lead');
        const parsedLead = leadData ? JSON.parse(leadData) : null;

        const { data, error: fnError } = await supabase.functions.invoke('generate-free-pack', {
          body: {
            userId: parsedLead?.id || 'anonymous',
            brandId: parsedLead?.brandId || 'temp-brand',
            email: email || parsedLead?.email || '',
            packMode: intent.packMode,
            brandData: {
              brandName: intent.brandName || 'Mon Business',
              sector: 'coach',
              styles: [intent.tone, intent.density],
              colorChoice: intent.stylePreset === 'pro' ? 'neutral' : 'bold',
              fontChoice: 'modern',
              objective: intent.goal,
              topic: intent.topic,
              cta: intent.cta,
            },
          },
        });

        if (fnError) {
          console.error('[CraftingScene] Generation error:', fnError);
          setError('Erreur lors de la génération. Réessaie.');
          return;
        }

        console.log('[CraftingScene] Generation result:', data);

        if (data?.success && data?.assets) {
          generatedAssets.current = data.assets;
        } else {
          // Use fallback assets if generation failed
          generatedAssets.current = [
            { title: 'Post Instagram', ratio: '1:1', url: '/images/hero-preview.jpg', thumbnailUrl: '/images/hero-preview.jpg' },
            { title: 'Story', ratio: '9:16', url: '/images/hero-preview.jpg', thumbnailUrl: '/images/hero-preview.jpg' },
            { title: 'Cover', ratio: '4:5', url: '/images/hero-preview.jpg', thumbnailUrl: '/images/hero-preview.jpg' },
          ];
        }
      } catch (err) {
        console.error('[CraftingScene] Unexpected error:', err);
        setError('Erreur inattendue. Réessaie.');
      }
    };

    generatePack();
  }, [intent, email]);

  const handleOpenChest = () => {
    if (generatedAssets.current.length > 0) {
      onComplete(generatedAssets.current);
    } else {
      // Try to fetch from backend if not available locally
      fetchAssetsFromBackend();
    }
  };

  const fetchAssetsFromBackend = async () => {
    if (!email) {
      onComplete([]);
      return;
    }
    
    try {
      const { data } = await supabase.functions.invoke('get-latest-free-pack', {
        body: { email }
      });
      
      if (data?.success && data?.assets?.length > 0) {
        onComplete(data.assets);
      } else {
        // Fallback to placeholder
        onComplete([
          { title: 'Post Instagram', ratio: '1:1', url: '/images/hero-preview.jpg', thumbnailUrl: '/images/hero-preview.jpg' },
          { title: 'Story', ratio: '9:16', url: '/images/hero-preview.jpg', thumbnailUrl: '/images/hero-preview.jpg' },
          { title: 'Cover', ratio: '4:5', url: '/images/hero-preview.jpg', thumbnailUrl: '/images/hero-preview.jpg' },
        ]);
      }
    } catch (err) {
      console.error('[CraftingScene] Failed to fetch assets:', err);
      onComplete([]);
    }
  };

  const handleResendEmail = async () => {
    if (!email || resending) return;
    
    setResending(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('resend-delivery-email', {
        body: { email }
      });
      
      if (fnError || !data?.success) {
        toast.error(data?.error || 'Erreur lors du renvoi');
      } else {
        toast.success('Email envoyé ! Vérifie ta boîte mail.');
      }
    } catch (err) {
      toast.error('Erreur lors du renvoi de l\'email');
    } finally {
      setResending(false);
    }
  };

  // Show completion UI when ready
  if (isComplete) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen w-full flex items-center justify-center p-4 relative"
      >
        <ParticleField count={50} speed="normal" />

        <div className="max-w-md w-full relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-border/50"
          >
            {/* Success icon */}
            <motion.div
              className="text-6xl text-center mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
              transition={{ type: 'spring' }}
            >
              🎁
            </motion.div>

            <h2 className="text-2xl font-bold text-center text-foreground mb-2">
              Ton pack est prêt ! 🎉
            </h2>

            {/* Email notice */}
            {email && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6 p-3 bg-muted/30 rounded-xl">
                <Mail className="w-4 h-4" />
                <span>Email envoyé à <strong>{email}</strong></span>
              </div>
            )}

            <p className="text-center text-muted-foreground mb-6">
              Pense à vérifier tes spams si tu ne le reçois pas.
            </p>

            {/* Main CTA */}
            <Button
              onClick={handleOpenChest}
              size="lg"
              className="w-full gap-2 mb-4 bg-gradient-to-r from-alfie-mint to-alfie-lilac text-foreground font-bold rounded-xl"
            >
              <Package className="w-5 h-5" />
              Ouvrir le coffre
            </Button>

            {/* Secondary actions */}
            <div className="flex flex-col gap-2">
              {email && (
                <Button
                  variant="ghost"
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="gap-2 text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'Envoi en cours...' : 'Renvoyer l\'email'}
                </Button>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.div>
    );
  }

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
            {intent.packMode === 'conversion' ? '🎯' : '⚒️'}
          </motion.div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-foreground mb-2">
            {intent.packMode === 'conversion' 
              ? 'Alfie prépare tes visuels de vente...'
              : 'Alfie forge ton pack...'}
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Quelques secondes et c'est prêt !
          </p>

          {/* Error State */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}

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
              const stepComplete = currentStep > index;
              const isCurrent = currentStep === index + 1;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl transition-all
                    ${stepComplete
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
                      ${stepComplete
                        ? 'bg-alfie-mint text-white'
                        : isCurrent
                        ? 'bg-gradient-to-br from-alfie-lilac to-alfie-pink text-white'
                        : 'bg-muted text-muted-foreground'
                      }
                    `}
                  >
                    {stepComplete ? (
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
                      stepComplete || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>

                  {/* Completion spark */}
                  {stepComplete && !prefersReducedMotion && (
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
