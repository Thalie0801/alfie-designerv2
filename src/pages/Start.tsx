import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocalStorageState } from '@/lib/useLocalStorageState';
import { toast } from 'sonner';

// Game components
import { GameShell } from '@/components/start/game/GameShell';
import { QuestScene } from '@/components/start/scenes/QuestScene';
import { CraftingScene } from '@/components/start/scenes/CraftingScene';
import { LootChestScene } from '@/components/start/scenes/LootChestScene';
import { EmailGateScene } from '@/components/start/scenes/EmailGateScene';

import type { Intent, FlowStep } from '@/lib/types/startFlow';
import { DEFAULT_INTENT } from '@/lib/types/startFlow';

export default function Start() {
  const [intent, setIntent] = useLocalStorageState<Intent>('alfie-start-intent', DEFAULT_INTENT);
  const [flowStep, setFlowStep] = useState<FlowStep>('wizard');

  const handleIntentUpdate = useCallback((updates: Partial<Intent>) => {
    setIntent((prev) => ({ ...prev, ...updates }));
  }, [setIntent]);

  const handleWizardComplete = useCallback(() => setFlowStep('email_gate'), []);
  
  const handleEmailGateContinue = useCallback((email?: string) => {
    if (email) {
      toast.success('Email sauvegardé !');
    }
    setFlowStep('generating');
  }, []);
  
  const handleGenerationComplete = useCallback(() => setFlowStep('delivery'), []);
  
  const handleVariation = useCallback(() => {
    toast.info('🔄 Génération d\'une variation...');
    setFlowStep('generating');
  }, []);
  
  const handleSavePreset = useCallback(() => {
    toast.success('💾 Preset sauvegardé !');
  }, []);

  return (
    <GameShell currentStep={flowStep} intent={intent} showHUD>
      <AnimatePresence mode="wait">
        {flowStep === 'wizard' && (
          <QuestScene
            key="wizard"
            intent={intent}
            onUpdate={handleIntentUpdate}
            onComplete={handleWizardComplete}
          />
        )}
        
        {flowStep === 'email_gate' && (
          <EmailGateScene
            key="email_gate"
            intent={intent}
            onContinue={handleEmailGateContinue}
          />
        )}
        
        {flowStep === 'generating' && (
          <CraftingScene key="generating" onComplete={handleGenerationComplete} />
        )}
        
        {flowStep === 'delivery' && (
          <LootChestScene
            key="delivery"
            onVariation={handleVariation}
            onSavePreset={handleSavePreset}
          />
        )}
      </AnimatePresence>
    </GameShell>
  );
}
