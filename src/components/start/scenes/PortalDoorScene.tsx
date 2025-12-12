import { motion, useReducedMotion } from 'framer-motion';
import { RuneButton } from '../ui/RuneButton';
import { GlowOrb } from '../game/GlowOrb';
import { ParticleField } from '../game/ParticleField';
import type { StylePreset } from '@/lib/types/startFlow';

interface PortalDoorSceneProps {
  onFinish: (preset: StylePreset) => void;
}

export function PortalDoorScene({ onFinish }: PortalDoorSceneProps) {
  const prefersReducedMotion = useReducedMotion();

  const handleSelect = (preset: StylePreset) => {
    if (prefersReducedMotion) {
      onFinish(preset);
    } else {
      // Warp animation delay
      setTimeout(() => onFinish(preset), 600);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative"
    >
      {/* Extra particles for portal scene */}
      <ParticleField count={30} speed="normal" />

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-8 relative z-10"
      >
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/60 backdrop-blur-sm mb-4"
          animate={!prefersReducedMotion ? { y: [0, -5, 0] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-lg">🎮</span>
          <span className="text-sm font-medium text-foreground">~90 secondes</span>
        </motion.div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2">
          Ouvre le Portail
        </h1>
        <p className="text-muted-foreground text-lg">
          Choisis ta vibe, repars avec ton loot.
        </p>
      </motion.div>

      {/* Portal + Runes */}
      <div className="relative flex items-center justify-center gap-6 sm:gap-12">
        {/* Left Rune - Pro */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <RuneButton emoji="💼" variant="pro" onClick={() => handleSelect('pro')}>
            Pro & clean
          </RuneButton>
        </motion.div>

        {/* Central Portal */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className="relative hidden sm:flex items-center justify-center"
        >
          {/* Portal glow layers */}
          <GlowOrb
            color="hsl(var(--alfie-lilac))"
            size={180}
            className="absolute"
            pulse
          />
          <GlowOrb
            color="hsl(var(--alfie-mint))"
            size={140}
            className="absolute"
            pulse
          />
          <GlowOrb
            color="hsl(var(--alfie-pink))"
            size={100}
            className="absolute"
            pulse
          />

          {/* Portal center */}
          <motion.div
            className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-white to-white/80 flex items-center justify-center shadow-2xl"
            animate={
              !prefersReducedMotion
                ? {
                    boxShadow: [
                      '0 0 30px rgba(126,226,224,0.5)',
                      '0 0 60px rgba(255,139,194,0.5)',
                      '0 0 30px rgba(224,201,255,0.5)',
                    ],
                  }
                : {}
            }
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-3xl">✨</span>
          </motion.div>
        </motion.div>

        {/* Right Rune - Pop */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <RuneButton emoji="🎨" variant="pop" onClick={() => handleSelect('pop')}>
            Pop & fun
          </RuneButton>
        </motion.div>
      </div>

      {/* Skip button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        onClick={() => handleSelect('pop')}
        className="mt-12 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded relative z-10"
      >
        Skip intro ⏭️
      </motion.button>
    </motion.div>
  );
}
