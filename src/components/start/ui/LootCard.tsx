import { motion, useReducedMotion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

const RARITY_STYLES: Record<Rarity, { border: string; bg: string; badge: string; glow: string }> = {
  common: {
    border: 'border-slate-300',
    bg: 'bg-slate-50',
    badge: 'bg-slate-400 text-white',
    glow: '',
  },
  rare: {
    border: 'border-blue-400',
    bg: 'bg-blue-50',
    badge: 'bg-blue-500 text-white',
    glow: 'shadow-blue-200',
  },
  epic: {
    border: 'border-purple-400',
    bg: 'bg-purple-50',
    badge: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    glow: 'shadow-purple-200',
  },
  legendary: {
    border: 'border-yellow-400',
    bg: 'bg-yellow-50',
    badge: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
    glow: 'shadow-yellow-200',
  },
};

const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  rare: '💎 Rare',
  epic: '⭐ Epic',
  legendary: '👑 Légendaire',
};

interface LootCardProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  rarity: Rarity;
  isSelected?: boolean;
  recommended?: boolean;
  onClick: () => void;
}

export function LootCard({
  icon: Icon,
  title,
  subtitle,
  rarity,
  isSelected = false,
  recommended = false,
  onClick,
}: LootCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const style = RARITY_STYLES[rarity];

  return (
    <motion.button
      whileHover={prefersReducedMotion ? {} : { scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`
        relative p-5 rounded-2xl border-2 text-left
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
        ${style.border} ${style.bg}
        ${isSelected ? `ring-2 ring-primary shadow-lg ${style.glow}` : 'hover:shadow-md'}
      `}
    >
      {/* Recommended badge */}
      {recommended && (
        <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-bold rounded-full bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-md">
          Reco ✨
        </span>
      )}

      {/* Rarity badge */}
      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mb-3 ${style.badge}`}>
        {RARITY_LABELS[rarity]}
      </span>

      {/* Icon */}
      <div className="mb-3">
        <Icon className={`w-10 h-10 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>

      {/* Title */}
      <h3 className="font-bold text-foreground text-lg">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          layoutId="loot-selected"
          className="absolute inset-0 rounded-2xl border-2 border-primary pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </motion.button>
  );
}
