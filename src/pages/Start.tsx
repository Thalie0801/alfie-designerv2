import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocalStorageState } from '@/lib/useLocalStorageState';
import { StartGateIntro } from '@/components/start/StartGateIntro';
import { BrandKitQuickPick } from '@/components/start/BrandKitQuickPick';
import { QuickStartWizard } from '@/components/start/QuickStartWizard';
import { StartIntentPanel } from '@/components/start/StartIntentPanel';
import { LivePreviewPane } from '@/components/start/LivePreviewPane';
import { JobConsoleMock } from '@/components/start/JobConsoleMock';
import { DeliveryHubMock } from '@/components/start/DeliveryHubMock';
import { toast } from 'sonner';
import type { StylePreset, Intent, FlowStep } from '@/lib/types/startFlow';
import { DEFAULT_INTENT } from '@/lib/types/startFlow';

export default function Start() {
  const [, setStylePreset] = useLocalStorageState<StylePreset>('alfie-start-preset', 'pop');
  const [intent, setIntent] = useLocalStorageState<Intent>('alfie-start-intent', DEFAULT_INTENT);
  const [flowStep, setFlowStep] = useState<FlowStep>('gate');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleGateFinish = useCallback((preset: StylePreset) => {
    setStylePreset(preset);
    setIntent((prev) => ({ ...prev, stylePreset: preset }));
    setFlowStep('brand');
  }, [setStylePreset, setIntent]);

  const handleBrandSelect = useCallback((brandKitId: string | null) => {
    setIntent((prev) => ({
      ...prev,
      brandKitId: brandKitId ?? undefined,
      brandLocks: brandKitId ? { palette: true, fonts: true, logo: true } : { palette: false, fonts: false, logo: false },
    }));
    setFlowStep('wizard');
  }, [setIntent]);

  const handleIntentUpdate = useCallback((updates: Partial<Intent>) => {
    setIntent((prev) => ({ ...prev, ...updates }));
  }, [setIntent]);

  const handleWizardComplete = useCallback(() => setFlowStep('recap'), []);
  const handleGenerate = useCallback(() => setFlowStep('generating'), []);
  const handleGenerationComplete = useCallback(() => setFlowStep('delivery'), []);
  const handleVariation = useCallback(() => { toast.info('Génération d\'une variation...'); setFlowStep('generating'); }, []);
  const handleSavePreset = useCallback(() => toast.success('Preset sauvegardé !'), []);

  const showLivePreview = !isMobile && (flowStep === 'wizard' || flowStep === 'recap');

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {flowStep === 'gate' && <StartGateIntro key="gate" onFinish={handleGateFinish} />}
        {flowStep === 'brand' && <BrandKitQuickPick key="brand" onSelect={handleBrandSelect} />}
        {flowStep === 'wizard' && (
          <div key="wizard" className="flex">
            <div className={showLivePreview ? 'flex-1' : 'w-full'}>
              <QuickStartWizard intent={intent} onUpdate={handleIntentUpdate} onComplete={handleWizardComplete} />
            </div>
            {showLivePreview && <div className="hidden md:block w-80 p-8"><LivePreviewPane intent={intent} /></div>}
          </div>
        )}
        {flowStep === 'recap' && (
          <div key="recap" className="flex">
            <div className={showLivePreview ? 'flex-1' : 'w-full'}>
              <StartIntentPanel intent={intent} onUpdate={handleIntentUpdate} onGenerate={handleGenerate} />
            </div>
            {showLivePreview && <div className="hidden md:block w-80 p-8"><LivePreviewPane intent={intent} /></div>}
          </div>
        )}
        {flowStep === 'generating' && <JobConsoleMock key="generating" onComplete={handleGenerationComplete} />}
        {flowStep === 'delivery' && <DeliveryHubMock key="delivery" onVariation={handleVariation} onSavePreset={handleSavePreset} />}
      </AnimatePresence>
      {isMobile && (flowStep === 'wizard' || flowStep === 'recap') && <LivePreviewPane intent={intent} isMobile />}
    </div>
  );
}
