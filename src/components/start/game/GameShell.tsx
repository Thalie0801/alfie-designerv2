import { ReactNode } from 'react';
import { ParticleField } from './ParticleField';
import { GameHUD } from './GameHUD';
import type { Intent, FlowStep } from '@/lib/types/startFlow';

interface GameShellProps {
  children: ReactNode;
  currentStep: FlowStep;
  intent: Intent;
  showHUD?: boolean;
}

export function GameShell({ children, currentStep, intent, showHUD = true }: GameShellProps) {
  return (
    <div
      className="min-h-screen w-full relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--alfie-mint) / 0.15) 0%, hsl(var(--alfie-pink) / 0.15) 25%, hsl(var(--alfie-lilac) / 0.15) 50%, hsl(var(--alfie-peach) / 0.15) 75%, hsl(var(--alfie-yellow) / 0.15) 100%)',
      }}
    >
      {/* Background Particles */}
      <ParticleField count={25} speed="slow" />

      {/* HUD */}
      {showHUD && currentStep !== 'gate' && (
        <GameHUD currentStep={currentStep} intent={intent} />
      )}

      {/* Main Scene */}
      <div className={`relative z-10 ${showHUD && currentStep !== 'gate' ? 'pt-20' : ''}`}>
        {children}
      </div>
    </div>
  );
}
