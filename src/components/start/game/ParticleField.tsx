import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

const PARTICLE_COLORS = [
  'hsl(var(--alfie-mint))',
  'hsl(var(--alfie-pink))',
  'hsl(var(--alfie-lilac))',
  'hsl(var(--alfie-peach))',
  'hsl(var(--alfie-yellow))',
];

interface ParticleFieldProps {
  count?: number;
  speed?: 'slow' | 'normal' | 'fast';
}

export function ParticleField({ count = 20, speed = 'normal' }: ParticleFieldProps) {
  const prefersReducedMotion = useReducedMotion();

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 8 + 4,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      delay: Math.random() * 2,
      duration: speed === 'slow' ? 8 : speed === 'fast' ? 3 : 5,
    }));
  }, [count, speed]);

  if (prefersReducedMotion) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full opacity-60"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            filter: 'blur(1px)',
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
