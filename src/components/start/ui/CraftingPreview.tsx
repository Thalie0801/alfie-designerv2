import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { Intent } from '@/lib/types/startFlow';

const DEFAULT_PALETTE = ['#7EE2E0', '#FF8BC2', '#E0C9FF', '#FFD4B8', '#FFF9C4'];

interface CraftingPreviewProps {
  intent: Intent;
  brandPalette?: string[];
}

export function CraftingPreview({ intent, brandPalette }: CraftingPreviewProps) {
  const prefersReducedMotion = useReducedMotion();
  const palette = brandPalette || DEFAULT_PALETTE;

  const getAspectRatio = () => {
    switch (intent.ratio) {
      case '9:16':
        return { width: 160, height: 284 };
      case '1:1':
        return { width: 220, height: 220 };
      case '4:5':
      default:
        return { width: 200, height: 250 };
    }
  };

  const { width, height } = getAspectRatio();

  return (
    <div className="flex flex-col items-center">
      {/* Title */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🔧</span>
        <h3 className="font-bold text-foreground">Atelier</h3>
      </div>

      {/* Preview Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${intent.ratio}-${intent.topic}`}
          initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
          className="relative rounded-2xl overflow-hidden"
          style={{
            width,
            height,
            background: `linear-gradient(145deg, ${palette[0]}60, ${palette[1]}40, ${palette[2]}60)`,
            boxShadow: `0 0 30px ${palette[1]}40, 0 10px 40px rgba(0,0,0,0.1)`,
            border: `2px solid ${palette[1]}50`,
          }}
        >
          {/* Blueprint grid overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(${palette[2]}30 1px, transparent 1px),
                linear-gradient(90deg, ${palette[2]}30 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
            }}
          />

          {/* Decorative orb */}
          <motion.div
            className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-50"
            style={{ backgroundColor: palette[1] }}
            animate={
              !prefersReducedMotion
                ? {
                    scale: [1, 1.1, 1],
                  }
                : {}
            }
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col justify-between p-4">
            {/* Goal badge */}
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 text-xs rounded-full bg-white/80 text-foreground font-medium">
                {intent.goal}
              </span>
            </div>

            {/* Title with sparkle effect on change */}
            <div className="flex-1 flex items-center justify-center">
              <motion.p
                key={intent.topic}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center font-bold text-foreground text-sm leading-tight px-2"
              >
                {intent.topic || '✨ Ton sujet ici...'}
              </motion.p>
            </div>

            {/* CTA badge */}
            <div
              className="self-center px-3 py-1.5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: palette[1] }}
            >
              {intent.cta}
            </div>
          </div>

          {/* Sparkle on topic change */}
          {intent.topic && !prefersReducedMotion && (
            <motion.div
              key={`spark-${intent.topic}`}
              initial={{ opacity: 1, scale: 0 }}
              animate={{ opacity: 0, scale: 2 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="text-4xl">✨</span>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Ingredients (palette) */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Ingrédients:</span>
        <div className="flex gap-1">
          {palette.map((color, i) => (
            <motion.div
              key={i}
              className="w-5 h-5 rounded-full border border-white/50"
              style={{ backgroundColor: color }}
              whileHover={{ scale: 1.2 }}
            />
          ))}
        </div>
      </div>

      {/* Stats */}
      <p className="text-xs text-muted-foreground mt-2">
        Slide 1/{intent.slides} • {intent.ratio}
      </p>
    </div>
  );
}
