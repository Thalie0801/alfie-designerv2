import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface DoorOverlayProps {
  isOpen: boolean;
  isClosing?: boolean;
  onAnimationComplete?: () => void;
}

export function DoorOverlay({ isOpen, isClosing = false, onAnimationComplete }: DoorOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  
  // Skip animation if reduced motion
  if (prefersReducedMotion && onAnimationComplete) {
    if (isOpen || isClosing) {
      setTimeout(onAnimationComplete, 100);
    }
    return null;
  }

  return (
    <AnimatePresence onExitComplete={onAnimationComplete}>
      {!isOpen && (
        <motion.div
          className="fixed inset-0 z-50 pointer-events-none"
          initial={isClosing ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Left door panel */}
          <motion.div
            className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 shadow-2xl"
            style={{
              transformOrigin: 'left center',
              backgroundImage: `
                linear-gradient(to right, hsl(var(--background)), hsl(220 20% 15%)),
                url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")
              `,
            }}
            initial={isClosing ? { rotateY: -90 } : { rotateY: 0 }}
            animate={{ rotateY: isClosing ? 0 : 0 }}
            exit={{ rotateY: -90 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Door decorations */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-24 rounded-full bg-gradient-to-b from-amber-400/30 to-amber-600/30 shadow-inner" />
            <div className="absolute right-8 top-1/4 w-1 h-32 bg-amber-500/20 rounded-full" />
            <div className="absolute right-8 bottom-1/4 w-1 h-32 bg-amber-500/20 rounded-full" />
          </motion.div>

          {/* Right door panel */}
          <motion.div
            className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-slate-900 via-slate-800 to-slate-700 shadow-2xl"
            style={{
              transformOrigin: 'right center',
              backgroundImage: `
                linear-gradient(to left, hsl(var(--background)), hsl(220 20% 15%)),
                url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")
              `,
            }}
            initial={isClosing ? { rotateY: 90 } : { rotateY: 0 }}
            animate={{ rotateY: isClosing ? 0 : 0 }}
            exit={{ rotateY: 90 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Door decorations */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-24 rounded-full bg-gradient-to-b from-amber-400/30 to-amber-600/30 shadow-inner" />
            <div className="absolute left-8 top-1/4 w-1 h-32 bg-amber-500/20 rounded-full" />
            <div className="absolute left-8 bottom-1/4 w-1 h-32 bg-amber-500/20 rounded-full" />
          </motion.div>

          {/* Center light glow when opening */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, scale: 0.5 }}
            exit={{ opacity: 1, scale: 3 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="w-32 h-64 bg-gradient-to-t from-amber-200/0 via-white/80 to-amber-200/0 blur-3xl" />
          </motion.div>

          {/* Light rays */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            exit={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-96 bg-gradient-to-t from-transparent via-white/40 to-transparent blur-sm"
                style={{
                  transform: `rotate(${i * 22.5}deg)`,
                  transformOrigin: 'center center',
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                exit={{ scaleY: 1, opacity: 0.6 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
