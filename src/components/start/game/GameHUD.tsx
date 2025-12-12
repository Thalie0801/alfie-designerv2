import { motion } from 'framer-motion';
import type { Intent, FlowStep } from '@/lib/types/startFlow';

const STEP_LABELS: Record<FlowStep, string> = {
  gate: 'Portail',
  brand: 'Équipement',
  wizard: 'Quête',
  recap: 'Préparation',
  generating: 'Forge',
  delivery: 'Loot',
};

const STEP_ORDER: FlowStep[] = ['gate', 'brand', 'wizard', 'recap', 'generating', 'delivery'];

interface GameHUDProps {
  currentStep: FlowStep;
  intent: Intent;
}

export function GameHUD({ currentStep, intent }: GameHUDProps) {
  const stepIndex = STEP_ORDER.indexOf(currentStep);
  const progress = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-background/80 backdrop-blur-md border-b border-border/50"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        {/* Level Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎮</span>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Niveau</p>
            <p className="font-bold text-foreground">{STEP_LABELS[currentStep]}</p>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="flex-1 max-w-xs hidden sm:block">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>XP</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, hsl(var(--alfie-mint)), hsl(var(--alfie-pink)), hsl(var(--alfie-lilac)))',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Inventory Chips */}
        <div className="flex items-center gap-1.5">
          {intent.kind && (
            <span className="px-2 py-1 text-xs rounded-full bg-alfie-mintSoft text-foreground font-medium">
              {intent.kind === 'pack' ? '📦' : intent.kind === 'carousel' ? '🎠' : '🖼️'}
            </span>
          )}
          {intent.ratio && (
            <span className="px-2 py-1 text-xs rounded-full bg-alfie-pinkSoft text-foreground font-medium hidden sm:inline-flex">
              {intent.ratio}
            </span>
          )}
          {intent.slides > 1 && (
            <span className="px-2 py-1 text-xs rounded-full bg-alfie-lilacSoft text-foreground font-medium hidden sm:inline-flex">
              {intent.slides}s
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
