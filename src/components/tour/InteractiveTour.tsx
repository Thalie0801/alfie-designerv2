import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { lsGet, lsSet, autoCompletedKey } from '@/utils/localStorage';

// ============= Types =============
type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

interface TourStep {
  selector: string;
  title: string;
  content: string;
  placement?: Placement;
}

interface TourOptions {
  userEmail?: string | null;
  autoStart?: 'on-first-login' | 'always' | 'never';
  skipForAdmins?: boolean;
  targets?: string[]; // selectors to wait for
}

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  bubbleVisible: boolean;
  start: (force?: boolean) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  goTo: (step: number) => void;
}

interface BubblePosition {
  top: number;
  left: number;
  placement: Placement;
}

// ============= Context =============
const TourContext = createContext<TourContextValue | undefined>(undefined);

export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
};

// ============= Platform Detection =============
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(max-width: 767px)')?.matches ?? false;
};

// ============= Tour Steps =============
const DEFAULT_STEPS: TourStep[] = [
  {
    selector: '[data-tour-id="nav-dashboard"]',
    title: '🏠 Votre Dashboard',
    content: 'Ici vous retrouvez tous vos Brand Kits, vos créations récentes et vos statistiques.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour-id="btn-create"]',
    title: '✨ Créer avec Alfie',
    content: 'Cliquez ici pour commencer à créer du contenu avec Alfie Designer, votre assistant créatif IA.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour-id="brand-kit"]',
    title: '🎨 Vos Brand Kits',
    content: 'Créez et gérez vos marques. Alfie utilisera ces informations pour personnaliser vos créations.',
    placement: 'top',
  },
  {
    selector: '[data-tour-id="quick-actions"]',
    title: '⚡ Actions rapides',
    content: 'Accédez rapidement aux fonctionnalités les plus utilisées : créer une marque, gérer vos assets, etc.',
    placement: 'right',
  },
];

// Utility to wait for DOM targets to be ready
const waitForTargets = (selectors: string[], maxWaitMs = 4000) => new Promise<boolean>((resolve) => {
  const hasAll = () => selectors.every((sel) => !!document.querySelector(sel));
  if (hasAll()) return resolve(true);
  const mo = new MutationObserver(() => {
    if (hasAll()) {
      mo.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      resolve(true);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tour-id'] });
  const timeoutId = window.setTimeout(() => {
    mo.disconnect();
    resolve(false);
  }, maxWaitMs);
});

// ============= Provider =============
interface TourProviderProps {
  children: React.ReactNode;
  steps?: TourStep[];
  options?: TourOptions;
}

export function TourProvider({ children, steps = DEFAULT_STEPS, options = {} }: TourProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const wasActiveRef = useRef(false);
  const forceRef = useRef(false);

  const { userEmail, autoStart = 'on-first-login' } = options;

  // Mark tour as auto-completed when it becomes inactive after being active
  useEffect(() => {
    if (wasActiveRef.current && !isActive && userEmail) {
      const key = autoCompletedKey(userEmail);
      lsSet(key, '1');
      console.debug('[Tour] Marked as auto-completed for', userEmail);
    }
    wasActiveRef.current = isActive;
  }, [isActive, userEmail]);

  const start = useCallback((force: boolean = false) => {
    forceRef.current = !!force;
    
    // Check if already auto-completed (unless force = true or autoStart = 'always')
    if (!force && autoStart !== 'always' && userEmail) {
      const key = autoCompletedKey(userEmail);
      if (lsGet(key) === '1') {
        console.debug('[Tour] Already auto-completed for', userEmail);
        return;
      }
    }
    setCurrentStep(0);
    setIsActive(true);
    console.debug('[Tour] Started', { force, userEmail });
  }, [userEmail, autoStart]);

  const stop = useCallback(() => {
    setIsActive(false);
    console.debug('[Tour] Stopped');
  }, []);

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      stop();
    }
  }, [currentStep, steps.length, stop]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const goTo = useCallback(
    (step: number) => {
      if (step >= 0 && step < steps.length) {
        setCurrentStep(step);
      }
    },
    [steps.length]
  );

  const value: TourContextValue = {
    isActive,
    currentStep,
    totalSteps: steps.length,
    bubbleVisible,
    start,
    stop,
    next,
    prev,
    goTo,
  };

  return (
    <TourContext.Provider value={value}>
      {children}
      {isActive && (
        <TourBubble 
          step={steps[currentStep]} 
          currentStep={currentStep} 
          totalSteps={steps.length}
          onVisibilityChange={setBubbleVisible}
          forceCenter={forceRef.current}
        />
      )}
    </TourContext.Provider>
  );
}

// ============= Tour Bubble Component =============
interface TourBubbleProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onVisibilityChange: (visible: boolean) => void;
  forceCenter: boolean;
}

function TourBubble({ step, currentStep, totalSteps, onVisibilityChange, forceCenter }: TourBubbleProps) {
  const { next, prev, stop } = useTour();
  const [position, setPosition] = useState<BubblePosition | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  const isMobile = isMobileDevice();

  // Calculate bubble position
  const calculatePosition = useCallback(() => {
    const target = document.querySelector(step.selector);
    
    // Always show bubble in center if target not found and forced restart
    if (!target && forceCenter) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Use fixed dimensions if bubbleRef not ready yet
      const bubbleHeight = bubbleRef.current?.getBoundingClientRect().height || 300;
      const bubbleWidth = bubbleRef.current?.getBoundingClientRect().width || (isMobile ? Math.min(320, viewportWidth * 0.9) : 380);
      
      setPosition({
        top: (viewportHeight - bubbleHeight) / 2,
        left: (viewportWidth - bubbleWidth) / 2,
        placement: 'center' as const
      });
      onVisibilityChange(true);
      return;
    }
    
    if (!target) {
      setPosition(null);
      onVisibilityChange(false);
      return;
    }
    
    if (!bubbleRef.current) {
      setPosition(null);
      onVisibilityChange(false);
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const bubbleRect = bubbleRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adaptive placement for mobile
    let placement = step.placement || (isMobile ? 'bottom' : 'right');
    const offset = isMobile ? 14 : 10;
    const padding = 20;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = targetRect.top - bubbleRect.height - offset;
        left = targetRect.left + targetRect.width / 2 - bubbleRect.width / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + targetRect.width / 2 - bubbleRect.width / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - bubbleRect.height / 2;
        left = targetRect.left - bubbleRect.width - offset;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - bubbleRect.height / 2;
        left = targetRect.right + offset;
        break;
      case 'center':
        top = viewportHeight / 2 - bubbleRect.height / 2;
        left = viewportWidth / 2 - bubbleRect.width / 2;
        break;
    }

    // Clamp to viewport with padding
    top = Math.max(padding, Math.min(top, viewportHeight - bubbleRect.height - padding));
    left = Math.max(padding, Math.min(left, viewportWidth - bubbleRect.width - padding));

    setPosition({ top, left, placement });
    onVisibilityChange(true);
  }, [step.selector, step.placement, isMobile, forceCenter, onVisibilityChange]);

  // Update position on mount, scroll, resize
  useEffect(() => {
    const updatePosition = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(calculatePosition);
    };

    updatePosition();

    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updatePosition)
        : null;

    const target = document.querySelector(step.selector);
    if (target && resizeObserver) {
      resizeObserver.observe(target);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
      resizeObserver?.disconnect();
      onVisibilityChange(false);
    };
  }, [step.selector, calculatePosition, onVisibilityChange]);

  if (!position) return null;

  const maxWidth = isMobile ? Math.min(320, window.innerWidth * 0.9) : 380;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9998]"
        onClick={stop}
      />
      
      {/* Bubble */}
      <Card
        ref={bubbleRef}
        className="fixed z-[9999] shadow-2xl border-2 border-primary/20 animate-in fade-in-0 zoom-in-95"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          maxWidth: `${maxWidth}px`,
          width: isMobile ? '90vw' : 'auto',
        }}
      >
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-lg leading-tight pr-2">{step.title}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={stop}
              className="h-6 w-6 p-0 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <p className="text-sm text-muted-foreground leading-relaxed">{step.content}</p>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentStep
                      ? 'w-6 bg-primary'
                      : 'w-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prev}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {!isMobile && 'Précédent'}
                </Button>
              )}
              <Button
                size="sm"
                onClick={next}
                className="gap-1"
              >
                {currentStep < totalSteps - 1 ? (
                  <>
                    {!isMobile && 'Suivant'}
                    <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  'Terminer'
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

// ============= Help Launcher =============
export function HelpLauncher() {
  const { start, isActive, bubbleVisible } = useTour();

  const handleClick = async () => {
    console.debug('[HelpLauncher] Clicked - waiting for tour targets');
    
    // Wait for all tour target elements to be ready
    const selectors = DEFAULT_STEPS.map(s => s.selector);
    const ready = await waitForTargets(selectors, 2000);
    
    if (ready) {
      console.debug('[HelpLauncher] All targets ready, starting tour');
      start(true); // Force restart even if tour was previously completed
    } else {
      console.warn('[HelpLauncher] Some targets not found, starting anyway');
      start(true);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isActive && bubbleVisible}
      className="gap-2"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Aide</span>
    </Button>
  );
}
