import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';

interface RuneButtonProps {
  children: ReactNode;
  emoji: string;
  variant: 'pro' | 'pop';
  onClick: () => void;
}

export function RuneButton({ children, emoji, variant, onClick }: RuneButtonProps) {
  const prefersReducedMotion = useReducedMotion();

  const colors = {
    pro: {
      bg: 'from-slate-600 to-slate-800',
      glow: 'shadow-slate-500/50',
      border: 'border-slate-400/30',
      hoverBg: 'hover:from-slate-500 hover:to-slate-700',
    },
    pop: {
      bg: 'from-pink-400 to-purple-500',
      glow: 'shadow-pink-500/50',
      border: 'border-pink-300/30',
      hoverBg: 'hover:from-pink-300 hover:to-purple-400',
    },
  };

  const style = colors[variant];

  return (
    <motion.button
      whileHover={prefersReducedMotion ? {} : { scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`
        relative group flex flex-col items-center justify-center
        w-32 h-40 sm:w-40 sm:h-48
        rounded-3xl border-2 ${style.border}
        bg-gradient-to-br ${style.bg} ${style.hoverBg}
        shadow-lg ${style.glow} hover:shadow-xl
        transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
      `}
      aria-label={`Choisir le style ${variant === 'pro' ? 'Pro & clean' : 'Pop & fun'}`}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `radial-gradient(circle at center, ${variant === 'pro' ? 'rgba(100,116,139,0.4)' : 'rgba(236,72,153,0.4)'} 0%, transparent 70%)`,
        }}
        animate={
          !prefersReducedMotion
            ? {
                opacity: [0.3, 0.6, 0.3],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Rune icon */}
      <motion.div
        className="relative z-10 text-5xl sm:text-6xl mb-3"
        animate={
          !prefersReducedMotion
            ? {
                y: [0, -5, 0],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {emoji}
      </motion.div>

      {/* Label */}
      <span className="relative z-10 text-white font-bold text-sm sm:text-base text-center px-2">
        {children}
      </span>

      {/* Corner decoration */}
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white/30" />
      <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-white/30" />
    </motion.button>
  );
}
