import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RuneButton } from '../ui/RuneButton';
import { GlowOrb } from '../game/GlowOrb';
import { ParticleField } from '../game/ParticleField';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { StylePreset } from '@/lib/types/startFlow';

interface PortalDoorSceneProps {
  onFinish: (preset: StylePreset) => void;
}

export function PortalDoorScene({ onFinish }: PortalDoorSceneProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isOpening, setIsOpening] = useState(false);

  const handleSelect = useCallback((preset: StylePreset) => {
    if (isOpening) return;
    
    setSelectedPreset(preset);
    setIsOpening(true);
    
    if (prefersReducedMotion) {
      onFinish(preset);
    } else {
      // Door opening animation then transition
      setTimeout(() => onFinish(preset), 1200);
    }
  }, [isOpening, prefersReducedMotion, onFinish]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Door panels overlay */}
      <AnimatePresence>
        {!isOpening && (
          <>
            {/* Left door */}
            <motion.div
              className="fixed top-0 left-0 w-1/2 h-full z-30 pointer-events-none"
              style={{
                background: 'linear-gradient(to right, hsl(220 20% 10%), hsl(220 20% 18%))',
                transformOrigin: 'left center',
              }}
              initial={{ rotateY: 0 }}
              exit={{ rotateY: -90 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Door frame decorations */}
              <div className="absolute right-0 top-0 w-3 h-full bg-gradient-to-r from-amber-900/30 to-transparent" />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-20 rounded-full bg-amber-600/40" />
              <div className="absolute right-4 top-1/4 w-1 h-24 bg-amber-500/20 rounded-full" />
              <div className="absolute right-4 bottom-1/4 w-1 h-24 bg-amber-500/20 rounded-full" />
              
              {/* Ornate patterns */}
              <div className="absolute inset-4 border border-amber-500/10 rounded-lg" />
              <div className="absolute inset-8 border border-amber-500/5 rounded-lg" />
            </motion.div>

            {/* Right door */}
            <motion.div
              className="fixed top-0 right-0 w-1/2 h-full z-30 pointer-events-none"
              style={{
                background: 'linear-gradient(to left, hsl(220 20% 10%), hsl(220 20% 18%))',
                transformOrigin: 'right center',
              }}
              initial={{ rotateY: 0 }}
              exit={{ rotateY: 90 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Door frame decorations */}
              <div className="absolute left-0 top-0 w-3 h-full bg-gradient-to-l from-amber-900/30 to-transparent" />
              <div className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-20 rounded-full bg-amber-600/40" />
              <div className="absolute left-4 top-1/4 w-1 h-24 bg-amber-500/20 rounded-full" />
              <div className="absolute left-4 bottom-1/4 w-1 h-24 bg-amber-500/20 rounded-full" />
              
              {/* Ornate patterns */}
              <div className="absolute inset-4 border border-amber-500/10 rounded-lg" />
              <div className="absolute inset-8 border border-amber-500/5 rounded-lg" />
            </motion.div>

            {/* Center seam glow */}
            <motion.div
              className="fixed top-0 left-1/2 -translate-x-1/2 w-2 h-full z-40 pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent 10%, rgba(255,200,100,0.3) 50%, transparent 90%)',
              }}
              exit={{ opacity: 0, scaleX: 10 }}
              transition={{ duration: 0.6 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Light burst when opening */}
      <AnimatePresence>
        {isOpening && (
          <motion.div
            className="fixed inset-0 z-20 pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Central light burst */}
            <motion.div
              className="absolute w-[200vw] h-[200vh] bg-gradient-radial from-white via-amber-100/50 to-transparent"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: [0, 1, 0.8] }}
              transition={{ duration: 1 }}
            />
            
            {/* Light rays */}
            {!prefersReducedMotion && [...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-[100vh] bg-gradient-to-t from-transparent via-white/60 to-transparent"
                style={{
                  transform: `rotate(${i * 30}deg)`,
                  transformOrigin: 'center center',
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: [0, 0.8, 0] }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background particles */}
      <ParticleField count={30} speed="normal" />

      {/* Content - visible through the door crack */}
      <div className="relative z-10">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
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
            <RuneButton 
              emoji="💼" 
              variant="pro" 
              onClick={() => handleSelect('pro')}
            >
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
            <GlowOrb color="hsl(var(--alfie-lilac))" size={180} className="absolute" pulse />
            <GlowOrb color="hsl(var(--alfie-mint))" size={140} className="absolute" pulse />
            <GlowOrb color="hsl(var(--alfie-pink))" size={100} className="absolute" pulse />

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
            <RuneButton 
              emoji="🎨" 
              variant="pop" 
              onClick={() => handleSelect('pop')}
            >
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
          disabled={isOpening}
          className="mt-12 mx-auto block text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded disabled:opacity-50"
        >
          Skip intro ⏭️
        </motion.button>
      </div>
    </motion.div>
  );
}
