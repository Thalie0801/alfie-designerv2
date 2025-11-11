import React, { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { lsGet, lsSet, autoCompletedKey } from "@/utils/localStorage";

/* ================= Types ================= */
type Placement = "top" | "bottom" | "left" | "right" | "center";

interface TourStep {
  selector: string; // 'center' => bubble centrée
  title: string;
  content: string; // accepte du markdown simple **bold** + \n\n
  placement?: Placement;
}

interface TourOptions {
  userEmail?: string | null;
  autoStart?: "on-first-login" | "always" | "never";
  skipForAdmins?: boolean;
  targets?: string[]; // selectors à attendre si tu utilises un autostart externe
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

const TourContext = createContext<TourContextValue | undefined>(undefined);
export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
};

/* ============== Utils ============== */
const isMobileDevice = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(max-width: 767px)")?.matches ?? false);

// markdown light : **bold** + \n\n => <br/><br/>
function renderLiteMarkdown(md: string) {
  const html = md.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n{2,}/g, "<br/><br/>");
  return { __html: html };
}

// Attente robuste de cibles (data-tour-id ET data-sidebar-id) + rAF polling
const waitForTargets = (selectors: string[], maxWaitMs = 4000) =>
  new Promise<boolean>((resolve) => {
    const hasAll = () => selectors.every((sel) => sel === "center" || !!document.querySelector(sel));
    if (hasAll()) return resolve(true);

    let timeoutId: number | undefined;
    let rafId: number | undefined;

    const mo = new MutationObserver(() => {
      if (hasAll()) done(true);
    });

    const done = (ok: boolean) => {
      mo.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      resolve(ok);
    };

    // Observe largement (ajoute aussi data-sidebar-id)
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-tour-id", "data-sidebar-id"],
    });

    const poll = () => {
      if (hasAll()) return done(true);
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    timeoutId = window.setTimeout(() => done(false), maxWaitMs);
  });

/* ============== Steps par défaut (inchangés) ============== */
const DEFAULT_STEPS: TourStep[] = [
  {
    selector: '[data-tour-id="nav-dashboard"]',
    title: "🏠 Bienvenue sur votre Dashboard",
    content: "Voici votre espace central. Retrouvez ici toutes vos statistiques et actions rapides.",
    placement: "right",
  },
  {
    selector: '[data-sidebar-id="chat"]',
    title: "💬 Chat Alfie - Mode Exploration",
    content:
      "Discutez naturellement avec Alfie. Idéal pour explorer des idées, poser des questions et être guidé pas à pas. Uploadez des images pour créer des variations ou les transformer en vidéos.",
    placement: "right",
  },
  {
    selector: '[data-tour-id="btn-create"]',
    title: "⚡ Créateur - Mode Expert",
    content:
      "Accès direct au générateur avec formulaire complet. Pour ceux qui savent exactement ce qu'ils veulent créer et veulent contrôler tous les paramètres.",
    placement: "bottom",
  },
  {
    selector: "center",
    title: "🎭 Deux modes pour deux usages",
    content:
      "**Chat Alfie** : Pour explorer et être guidé avec une IA conversationnelle.\n\n**Créateur** : Pour produire rapidement avec contrôle total sur les paramètres.\n\nChoisissez selon votre besoin du moment !",
    placement: "center",
  },
  {
    selector: '[data-tour-id="quotas"]',
    title: "📊 Vos quotas & Woofs",
    content:
      "Suivez vos images, vidéos et Woofs (crédits pour vidéos Premium Sora/Veo). Les compteurs se réinitialisent automatiquement le 1er de chaque mois. Les Woofs non utilisés ne sont pas reportés.",
    placement: "top",
  },
  {
    selector: '[data-tour-id="quick-actions"]',
    title: "⚡ Actions rapides",
    content: "Accédez rapidement à vos actions les plus courantes.",
    placement: "top",
  },
  {
    selector: '[data-tour-id="brand-kit"]',
    title: "🎨 Brand Kit",
    content: "Gérez vos marques et personnalisez vos contenus avec votre identité visuelle.",
    placement: "bottom",
  },
  {
    selector: '[data-tour-id="add-brand"]',
    title: "➕ Ajouter une marque",
    content: "Créez une nouvelle marque pour organiser vos contenus.",
    placement: "left",
  },
  {
    selector: '[data-sidebar-id="library"]',
    title: "📚 Bibliothèque",
    content: "Retrouvez tous vos contenus créés dans la bibliothèque.",
    placement: "right",
  },
  {
    selector: '[data-tour-id="news"]',
    title: "📰 Actualités",
    content: "Restez informé des dernières nouveautés et mises à jour.",
    placement: "top",
  },
  {
    selector: '[data-tour-id="suggest"]',
    title: "💡 Suggestions",
    content: "Partagez vos idées pour améliorer la plateforme.",
    placement: "top",
  },
  {
    selector: '[data-sidebar-id="affiliate"]',
    title: "🤝 Programme d'affiliation",
    content: "Parrainez vos amis et gagnez des récompenses.",
    placement: "right",
  },
];

/* ============== Provider ============== */
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

  const { userEmail, autoStart = "on-first-login" } = options;

  // marque auto-complete quand on sort d'un état actif
  useEffect(() => {
    if (wasActiveRef.current && !isActive && userEmail) {
      lsSet(autoCompletedKey(userEmail), "1");
      console.debug("[Tour] Marked as auto-completed for", userEmail);
    }
    wasActiveRef.current = isActive;
  }, [isActive, userEmail]);

  const start = useCallback(
    (force = false) => {
      forceRef.current = !!force;
      if (!force && autoStart !== "always" && userEmail) {
        const done = lsGet(autoCompletedKey(userEmail)) === "1";
        if (done) {
          console.debug("[Tour] Already auto-completed for", userEmail);
          return;
        }
      }
      setCurrentStep(0);
      setIsActive(true);
      console.debug("[Tour] Started", { force, userEmail });
    },
    [userEmail, autoStart],
  );

  const stop = useCallback(() => {
    setIsActive(false);
  }, []);
  const next = useCallback(
    () => setCurrentStep((s) => (s < steps.length - 1 ? s + 1 : (stop(), s))),
    [steps.length, stop],
  );
  const prev = useCallback(() => setCurrentStep((s) => (s > 0 ? s - 1 : s)), []);
  const goTo = useCallback(
    (n: number) => {
      if (n >= 0 && n < steps.length) setCurrentStep(n);
    },
    [steps.length],
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

/* ============== Arrow ============== */
const Arrow = ({ placement }: { placement: Placement }) => {
  const cls = {
    top: "absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg",
    bottom:
      "absolute left-1/2 -translate-x-1/2 -top-2 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[12px] border-l-transparent border-r-transparent border-b-primary drop-shadow-lg",
    left: "absolute top-1/2 -translate-y-1/2 -right-2 w-0 h-0 border-t-[12px] border-b-[12px] border-l-[12px] border-t-transparent border-b-transparent border-l-primary drop-shadow-lg",
    right:
      "absolute top-1/2 -translate-y-1/2 -left-2 w-0 h-0 border-t-[12px] border-b-[12px] border-r-[12px] border-t-transparent border-b-transparent border-r-primary drop-shadow-lg",
    center: "hidden",
  };
  return <div className={cls[placement]} />;
};

/* ============== Bubble ============== */
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

  const getTarget = () => (step.selector === "center" ? null : document.querySelector(step.selector));

  const calculatePosition = useCallback(() => {
    const target = getTarget();

    // center si force ou pas de cible
    if (!target && (forceCenter || step.selector === "center")) {
      const vw = window.innerWidth,
        vh = window.innerHeight;
      const br = bubbleRef.current?.getBoundingClientRect();
      const bw = br?.width ?? (isMobile ? Math.min(320, vw * 0.9) : 380);
      const bh = br?.height ?? 300;
      setPosition({ top: (vh - bh) / 2, left: (vw - bw) / 2, placement: "center" });
      onVisibilityChange(true);
      return;
    }
    if (!target || !bubbleRef.current) {
      setPosition(null);
      onVisibilityChange(false);
      return;
    }

    const tr = (target as HTMLElement).getBoundingClientRect();
    const br = bubbleRef.current.getBoundingClientRect();
    const vw = window.innerWidth,
      vh = window.innerHeight;

    let placement: Placement = step.placement || (isMobile ? "bottom" : "right");
    const offset = isMobile ? 14 : 10,
      pad = 20;
    let top = 0,
      left = 0;

    switch (placement) {
      case "top":
        top = tr.top - br.height - offset;
        left = tr.left + tr.width / 2 - br.width / 2;
        break;
      case "bottom":
        top = tr.bottom + offset;
        left = tr.left + tr.width / 2 - br.width / 2;
        break;
      case "left":
        top = tr.top + tr.height / 2 - br.height / 2;
        left = tr.left - br.width - offset;
        break;
      case "right":
        top = tr.top + tr.height / 2 - br.height / 2;
        left = tr.right + offset;
        break;
      case "center":
        top = vh / 2 - br.height / 2;
        left = vw / 2 - br.width / 2;
        break;
    }

    // clamp viewport
    top = Math.max(pad, Math.min(top, vh - br.height - pad));
    left = Math.max(pad, Math.min(left, vw - br.width - pad));

    setPosition({ top, left, placement });
    onVisibilityChange(true);
  }, [step.selector, step.placement, isMobile, forceCenter, onVisibilityChange]);

  // focus, clavier, recalc
  useLayoutEffect(() => {
    const update = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(calculatePosition);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    const target = getTarget() as HTMLElement | null;
    if (target) {
      target.classList.add("tour-target-highlight");
      target.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    }

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (target && ro) ro.observe(target);

    // focus le dialog au mount
    const to = setTimeout(() => bubbleRef.current?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        stop();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("keydown", onKey);
      ro?.disconnect();
      clearTimeout(to);
      target?.classList.remove("tour-target-highlight");
      onVisibilityChange(false);
    };
  }, [calculatePosition, onVisibilityChange, next, prev, stop]);

  const maxWidth = isMobile ? Math.min(320, window.innerWidth * 0.9) : 380;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-background/80 z-[9998]" onClick={stop} aria-hidden="true" />

      {/* Dialog / Bubble */}
      <Card
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-label="Aide interactive"
        tabIndex={-1}
        className="fixed z-[9999] shadow-2xl border-2 border-primary/20 animate-in fade-in-0 zoom-in-95 outline-none"
        style={{
          top: `${position?.top ?? -9999}px`,
          left: `${position?.left ?? -9999}px`,
          maxWidth: `${maxWidth}px`,
          width: isMobile ? "90vw" : "auto",
          visibility: position ? "visible" : "hidden",
          pointerEvents: position ? "auto" : "none",
        }}
      >
        {position && <Arrow placement={position.placement} />}
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-lg leading-tight pr-2">{step.title}</h3>
            <Button variant="ghost" size="sm" onClick={stop} className="h-6 w-6 p-0 shrink-0" aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content (markdown light) */}
          <div
            className="text-sm text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={renderLiteMarkdown(step.content)}
          />

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1" aria-label="Progression du tutoriel">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${idx === currentStep ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button variant="ghost" size="sm" onClick={prev} className="gap-1" aria-label="Précédent">
                  <ChevronLeft className="h-4 w-4" /> {!isMobile && "Précédent"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={next}
                className="gap-1"
                aria-label={currentStep < totalSteps - 1 ? "Suivant" : "Terminer"}
              >
                {currentStep < totalSteps - 1 ? (
                  <>
                    <span className="hidden sm:inline">Suivant</span>
                    <ChevronRight className="h-4 w-4" />
                  </>
                ) : (
                  "Terminer"
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}

/* ============== Help Launcher ============== */
export function HelpLauncher() {
  const { start, isActive, bubbleVisible } = useTour();

  const safeStart = useCallback(async () => {
    const selectors = DEFAULT_STEPS.map((s) => s.selector);
    const visible = document.visibilityState === "visible";
    if (!visible) return;

    const ready = await waitForTargets(selectors, 2000);
    if (!ready) console.warn("[HelpLauncher] Some targets missing, starting anyway");
    start(true);
  }, [start]);

  useEffect(() => {
    // Empty effect - kept for potential future visibility listeners
    return () => {
      /* noop cleanup placeholder */
    };
  }, [safeStart]);

  return (
    <Button variant="outline" size="sm" onClick={safeStart} disabled={isActive && bubbleVisible} className="gap-2">
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Aide</span>
    </Button>
  );
}
