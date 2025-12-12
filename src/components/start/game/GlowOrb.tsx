import { motion, useReducedMotion } from 'framer-motion';

interface GlowOrbProps {
  color?: string;
  size?: number;
  className?: string;
  pulse?: boolean;
}

export function GlowOrb({ 
  color = 'hsl(var(--alfie-mint))', 
  size = 200, 
  className = '',
  pulse = true 
}: GlowOrbProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${color}, transparent 70%)`,
        boxShadow: `0 0 ${size / 2}px ${size / 4}px ${color}40`,
      }}
      animate={
        pulse && !prefersReducedMotion
          ? {
              scale: [1, 1.05, 1],
              opacity: [0.6, 0.9, 0.6],
            }
          : {}
      }
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}
