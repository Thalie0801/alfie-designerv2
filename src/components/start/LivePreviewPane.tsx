import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Intent } from '@/pages/Start';

// Default Alfie candy palette
const DEFAULT_PALETTE = ['#7EE2E0', '#FF8BC2', '#E0C9FF', '#FFD4B8', '#FFF9C4'];

interface LivePreviewPaneProps {
  intent: Intent;
  brandPalette?: string[];
  isMobile?: boolean;
}

export function LivePreviewPane({ intent, brandPalette, isMobile = false }: LivePreviewPaneProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const palette = brandPalette || DEFAULT_PALETTE;

  // Calculate aspect ratio dimensions
  const getAspectRatio = () => {
    switch (intent.ratio) {
      case '9:16':
        return { width: 180, height: 320 };
      case '1:1':
        return { width: 280, height: 280 };
      case '4:5':
      default:
        return { width: 240, height: 300 };
    }
  };

  const { width, height } = getAspectRatio();

  // Style based on preset
  const titleWeight = intent.stylePreset === 'pro' ? 'font-semibold' : 'font-bold';
  const subtitleStyle = intent.stylePreset === 'pro' ? 'text-sm' : 'text-base';

  // Density affects spacing
  const getPadding = () => {
    switch (intent.density) {
      case 'airy':
        return 'p-8';
      case 'compact':
        return 'p-4';
      default:
        return 'p-6';
    }
  };

  const PreviewCard = () => (
    <motion.div
      key={`${intent.ratio}-${intent.stylePreset}-${intent.density}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-2xl overflow-hidden shadow-xl"
      style={{
        width,
        height,
        background: `linear-gradient(135deg, ${palette[0]}40 0%, ${palette[1]}40 50%, ${palette[2]}40 100%)`,
      }}
    >
      {/* Decorative elements */}
      <div
        className="absolute top-4 right-4 w-16 h-16 rounded-full opacity-50"
        style={{ backgroundColor: palette[1] }}
      />
      <div
        className="absolute bottom-8 left-4 w-8 h-8 rounded-lg opacity-40"
        style={{ backgroundColor: palette[2] }}
      />

      {/* Content */}
      <div className={`relative z-10 h-full flex flex-col justify-between ${getPadding()}`}>
        {/* Title area */}
        <div>
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
            {intent.goal}
          </p>
          <h3 className={`${titleWeight} text-foreground leading-tight`}>
            {intent.topic || 'Votre titre accrocheur ici'}
          </h3>
        </div>

        {/* Middle content (bullets) */}
        <div className={`${subtitleStyle} text-muted-foreground space-y-2`}>
          <p>• Point clé numéro un</p>
          <p>• Point clé numéro deux</p>
          <p>• Point clé numéro trois</p>
        </div>

        {/* CTA */}
        <div
          className="inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-medium text-white self-start"
          style={{ backgroundColor: palette[1] }}
        >
          {intent.cta}
        </div>
      </div>
    </motion.div>
  );

  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full bg-white/95 backdrop-blur-sm border-t border-border py-3 px-4 flex items-center justify-between"
        >
          <span className="font-medium text-foreground">Aperçu</span>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          )}
        </motion.button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="bg-white/95 backdrop-blur-sm overflow-hidden"
            >
              <div className="p-4 flex justify-center">
                <PreviewCard />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="sticky top-4 flex flex-col items-center">
      <p className="text-sm font-medium text-muted-foreground mb-4">Aperçu live</p>
      <AnimatePresence mode="wait">
        <PreviewCard />
      </AnimatePresence>
      <p className="text-xs text-muted-foreground mt-4 text-center max-w-[200px]">
        Slide 1/{intent.slides} • {intent.ratio}
      </p>
    </div>
  );
}
