import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { StylePreset } from '@/lib/types/startFlow';

interface PortalDoorSceneProps {
  onFinish: (preset: StylePreset) => void;
}

export function PortalDoorScene({ onFinish }: PortalDoorSceneProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isOpening, setIsOpening] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<StylePreset | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pause video at door-closed frame on mount
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0.5; // Start at closed door frame
      videoRef.current.pause();
    }
  }, []);

  const handleSelect = useCallback((preset: StylePreset) => {
    if (isOpening) return;
    
    setSelectedPreset(preset);
    setIsOpening(true);
    
    // Play the door opening video
    if (videoRef.current) {
      videoRef.current.play();
    }
    
    if (prefersReducedMotion) {
      onFinish(preset);
    } else {
      setTimeout(() => onFinish(preset), 2500);
    }
  }, [isOpening, prefersReducedMotion, onFinish]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Video background - the door */}
      <video
        ref={videoRef}
        src="/videos/door-opening.mp4"
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      
      {/* Overlay gradient for better text visibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 z-5 pointer-events-none" />

      {/* Ambient torchlight flicker */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <motion.div
          className="absolute top-10 left-10 w-32 h-32 rounded-full bg-amber-500/20 blur-3xl"
          animate={{ opacity: [0.3, 0.6, 0.4, 0.5] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-10 right-10 w-32 h-32 rounded-full bg-orange-500/20 blur-3xl"
          animate={{ opacity: [0.4, 0.3, 0.5, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </div>

      {/* Door panels - z-10 so cards can be above */}
      <div className="fixed inset-0 flex z-10 pointer-events-none">
        <AnimatePresence>
          {!isOpening ? (
            <>
              {/* Left Door Panel */}
              <motion.div
                className="w-1/2 h-full relative"
                style={{ 
                  transformOrigin: 'left center',
                  perspective: '1200px',
                }}
                initial={{ rotateY: 0 }}
                exit={{ rotateY: -85 }}
                transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[hsl(25,40%,18%)] via-[hsl(25,35%,22%)] to-[hsl(25,30%,15%)]">
                  {/* Wood grain pattern */}
                  <div 
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: `repeating-linear-gradient(
                        90deg,
                        transparent 0px,
                        transparent 8px,
                        hsl(25 30% 12% / 0.5) 8px,
                        hsl(25 30% 12% / 0.5) 10px
                      )`,
                    }}
                  />
                  
                  {/* Horizontal wood planks */}
                  {[0.15, 0.35, 0.55, 0.75].map((pos, i) => (
                    <div 
                      key={i}
                      className="absolute left-4 right-0 h-px bg-gradient-to-r from-transparent via-amber-900/40 to-amber-800/20"
                      style={{ top: `${pos * 100}%` }}
                    />
                  ))}
                  
                  {/* Metal studs/rivets */}
                  {[0.2, 0.4, 0.6, 0.8].map((y) => (
                    <div key={y} className="absolute right-6" style={{ top: `${y * 100}%` }}>
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 shadow-lg border border-amber-300/30" />
                    </div>
                  ))}
                  
                  {/* Door handle / knocker */}
                  <div className="absolute right-8 top-1/2 -translate-y-1/2">
                    <div className="w-6 h-12 rounded-full bg-gradient-to-b from-amber-500 via-amber-700 to-amber-900 shadow-xl border-2 border-amber-400/40" />
                  </div>
                  
                  {/* Decorative metal hinge */}
                  <div className="absolute left-0 top-1/4 w-24 h-3 bg-gradient-to-r from-amber-700 via-amber-800 to-transparent rounded-r-full shadow-md" />
                  <div className="absolute left-0 top-3/4 w-24 h-3 bg-gradient-to-r from-amber-700 via-amber-800 to-transparent rounded-r-full shadow-md" />
                  
                  {/* Alfie color accents */}
                  <div className="absolute inset-4 border-2 border-[hsl(var(--alfie-mint))]/10 rounded-lg" />
                  <motion.div 
                    className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[hsl(var(--alfie-mint))]/30 via-[hsl(var(--alfie-pink))]/20 to-[hsl(var(--alfie-lilac))]/30"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </motion.div>

              {/* Right Door Panel */}
              <motion.div
                className="w-1/2 h-full relative"
                style={{ 
                  transformOrigin: 'right center',
                  perspective: '1200px',
                }}
                initial={{ rotateY: 0 }}
                exit={{ rotateY: 85 }}
                transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="absolute inset-0 bg-gradient-to-l from-[hsl(25,40%,18%)] via-[hsl(25,35%,22%)] to-[hsl(25,30%,15%)]">
                  {/* Wood grain pattern */}
                  <div 
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: `repeating-linear-gradient(
                        90deg,
                        transparent 0px,
                        transparent 8px,
                        hsl(25 30% 12% / 0.5) 8px,
                        hsl(25 30% 12% / 0.5) 10px
                      )`,
                    }}
                  />
                  
                  {/* Horizontal wood planks */}
                  {[0.15, 0.35, 0.55, 0.75].map((pos, i) => (
                    <div 
                      key={i}
                      className="absolute left-0 right-4 h-px bg-gradient-to-l from-transparent via-amber-900/40 to-amber-800/20"
                      style={{ top: `${pos * 100}%` }}
                    />
                  ))}
                  
                  {/* Metal studs/rivets */}
                  {[0.2, 0.4, 0.6, 0.8].map((y) => (
                    <div key={y} className="absolute left-6" style={{ top: `${y * 100}%` }}>
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 shadow-lg border border-amber-300/30" />
                    </div>
                  ))}
                  
                  {/* Door handle / knocker */}
                  <div className="absolute left-8 top-1/2 -translate-y-1/2">
                    <div className="w-6 h-12 rounded-full bg-gradient-to-b from-amber-500 via-amber-700 to-amber-900 shadow-xl border-2 border-amber-400/40" />
                  </div>
                  
                  {/* Decorative metal hinge */}
                  <div className="absolute right-0 top-1/4 w-24 h-3 bg-gradient-to-l from-amber-700 via-amber-800 to-transparent rounded-l-full shadow-md" />
                  <div className="absolute right-0 top-3/4 w-24 h-3 bg-gradient-to-l from-amber-700 via-amber-800 to-transparent rounded-l-full shadow-md" />
                  
                  {/* Alfie color accents */}
                  <div className="absolute inset-4 border-2 border-[hsl(var(--alfie-lilac))]/10 rounded-lg" />
                  <motion.div 
                    className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[hsl(var(--alfie-lilac))]/30 via-[hsl(var(--alfie-pink))]/20 to-[hsl(var(--alfie-mint))]/30"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  />
                </div>
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        {/* Center seam glow - always visible, intensifies on opening */}
        <motion.div
          className="absolute left-1/2 top-0 -translate-x-1/2 w-1 h-full"
          style={{
            background: 'linear-gradient(to bottom, transparent 5%, hsl(var(--alfie-mint) / 0.4) 30%, hsl(var(--alfie-pink) / 0.5) 50%, hsl(var(--alfie-lilac) / 0.4) 70%, transparent 95%)',
          }}
          animate={isOpening ? { width: '100vw', opacity: [1, 0] } : { opacity: [0.5, 0.8, 0.5] }}
          transition={isOpening ? { duration: 0.8 } : { duration: 2, repeat: Infinity }}
        />
      </div>

      {/* Light burst when opening */}
      <AnimatePresence>
        {isOpening && (
          <motion.div
            className="fixed inset-0 z-20 pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Central light burst with Alfie colors */}
            <motion.div
              className="absolute w-[200vw] h-[200vh]"
              style={{
                background: 'radial-gradient(circle, hsl(var(--alfie-mint) / 0.8) 0%, hsl(var(--alfie-pink) / 0.4) 30%, hsl(var(--alfie-lilac) / 0.2) 50%, transparent 70%)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 2, opacity: [0, 1, 0.9] }}
              transition={{ duration: 1.2 }}
            />
            
            {/* Light rays */}
            {!prefersReducedMotion && [...Array(16)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-[100vh]"
                style={{
                  background: `linear-gradient(to top, transparent, ${i % 2 === 0 ? 'hsl(var(--alfie-mint) / 0.6)' : 'hsl(var(--alfie-pink) / 0.6)'}, transparent)`,
                  transform: `rotate(${i * 22.5}deg)`,
                  transformOrigin: 'center center',
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: [0, 0.8, 0] }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content layer - ABOVE the door (z-30) */}
      <div className="relative z-30">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-sm border border-amber-500/20 mb-4"
            animate={!prefersReducedMotion ? { y: [0, -5, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-lg">🏰</span>
            <span className="text-sm font-medium text-amber-200">~90 secondes</span>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg">
            Ouvre le Portail
          </h1>
          <p className="text-amber-200/80 text-lg">
            Choisis ta vibe, repars avec ton loot.
          </p>
        </motion.div>

        {/* Style selection cards - Medieval shields */}
        <div className="flex items-center justify-center gap-6 sm:gap-12">
          {/* Pro Shield */}
          <motion.button
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={!prefersReducedMotion ? { scale: 1.05, y: -8 } : {}}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelect('pro')}
            disabled={isOpening}
            className={`
              relative group flex flex-col items-center justify-center
              w-36 h-48 sm:w-44 sm:h-56
              disabled:pointer-events-none
              focus:outline-none focus:ring-2 focus:ring-[hsl(var(--alfie-mint))] focus:ring-offset-2 focus:ring-offset-transparent
            `}
            aria-label="Choisir le style Pro & clean"
          >
            {/* Shield shape */}
            <div 
              className={`
                absolute inset-0 rounded-t-3xl transition-all duration-300
                bg-gradient-to-b from-slate-600 via-slate-700 to-slate-900
                border-2 border-slate-400/40
                group-hover:border-[hsl(var(--alfie-mint))]/60
                group-hover:shadow-[0_0_30px_hsl(var(--alfie-mint)/0.4)]
                ${selectedPreset === 'pro' ? 'ring-4 ring-[hsl(var(--alfie-mint))] shadow-[0_0_40px_hsl(var(--alfie-mint)/0.6)]' : ''}
              `}
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)',
              }}
            >
              {/* Metal rim */}
              <div className="absolute inset-2 rounded-t-2xl border border-amber-500/20" 
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)' }}
              />
              
              {/* Decorative rivets */}
              <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-amber-500/60" />
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-500/60" />
            </div>
            
            {/* Content */}
            <div className="relative z-10 flex flex-col items-center pt-6">
              <motion.span 
                className="text-5xl sm:text-6xl mb-3"
                animate={!prefersReducedMotion ? { y: [0, -5, 0] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                💼
              </motion.span>
              <span className="text-white font-bold text-base sm:text-lg">Pro & clean</span>
              <span className="text-slate-300 text-xs mt-1">Élégant, sobre</span>
            </div>
            
            {/* Glow effect on hover */}
            <motion.div
              className="absolute inset-0 rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)',
                background: 'radial-gradient(circle at center, hsl(var(--alfie-mint) / 0.2) 0%, transparent 70%)',
              }}
            />
          </motion.button>

          {/* Pop Shield */}
          <motion.button
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={!prefersReducedMotion ? { scale: 1.05, y: -8 } : {}}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSelect('pop')}
            disabled={isOpening}
            className={`
              relative group flex flex-col items-center justify-center
              w-36 h-48 sm:w-44 sm:h-56
              disabled:pointer-events-none
              focus:outline-none focus:ring-2 focus:ring-[hsl(var(--alfie-pink))] focus:ring-offset-2 focus:ring-offset-transparent
            `}
            aria-label="Choisir le style Pop & fun"
          >
            {/* Shield shape */}
            <div 
              className={`
                absolute inset-0 rounded-t-3xl transition-all duration-300
                bg-gradient-to-b from-[hsl(var(--alfie-pink))] via-purple-500 to-purple-800
                border-2 border-pink-300/40
                group-hover:border-[hsl(var(--alfie-pink))]/80
                group-hover:shadow-[0_0_30px_hsl(var(--alfie-pink)/0.5)]
                ${selectedPreset === 'pop' ? 'ring-4 ring-[hsl(var(--alfie-pink))] shadow-[0_0_40px_hsl(var(--alfie-pink)/0.6)]' : ''}
              `}
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)',
              }}
            >
              {/* Metal rim */}
              <div className="absolute inset-2 rounded-t-2xl border border-white/20" 
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)' }}
              />
              
              {/* Decorative rivets */}
              <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-white/60" />
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white/60" />
            </div>
            
            {/* Content */}
            <div className="relative z-10 flex flex-col items-center pt-6">
              <motion.span 
                className="text-5xl sm:text-6xl mb-3"
                animate={!prefersReducedMotion ? { y: [0, -5, 0] } : {}}
                transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
              >
                🎨
              </motion.span>
              <span className="text-white font-bold text-base sm:text-lg">Pop & fun</span>
              <span className="text-pink-200 text-xs mt-1">Coloré, audacieux</span>
            </div>
            
            {/* Glow effect on hover */}
            <motion.div
              className="absolute inset-0 rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 75%, 50% 100%, 0 75%)',
                background: 'radial-gradient(circle at center, hsl(var(--alfie-pink) / 0.3) 0%, transparent 70%)',
              }}
            />
          </motion.button>
        </div>

        {/* Skip button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={() => handleSelect('pop')}
          disabled={isOpening}
          className="mt-10 mx-auto block text-sm text-amber-300/70 hover:text-amber-200 underline underline-offset-4 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 rounded disabled:opacity-50"
        >
          Skip intro ⏭️
        </motion.button>
      </div>
    </motion.div>
  );
}
