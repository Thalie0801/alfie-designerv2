import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ExternalLink, Download, Copy, RefreshCw, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ParticleField } from '../game/ParticleField';

interface LootChestSceneProps {
  onVariation: () => void;
  onSavePreset: () => void;
}

export function LootChestScene({ onVariation, onSavePreset }: LootChestSceneProps) {
  const [copied, setCopied] = useState(false);
  const [chestOpened, setChestOpened] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Auto-open chest after mount
  useState(() => {
    const timer = setTimeout(() => setChestOpened(true), 500);
    return () => clearTimeout(timer);
  });

  const handleCopyTexts = () => {
    const mockTexts = `Slide 1: Hook - Attention ! Vous perdez 3h par semaine sur Canva ?
    
Slide 2: Problème - Le design prend du temps. Beaucoup trop de temps.

Slide 3: Solution - Alfie génère vos visuels en 90 secondes.

Slide 4: Preuve - +2000 créateurs utilisent déjà Alfie.

Slide 5: CTA - Testez gratuitement maintenant !`;

    navigator.clipboard.writeText(mockTexts);
    setCopied(true);
    toast.success('Textes copiés ! 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  const lootCards = [
    {
      id: 'canva',
      title: 'Ouvrir dans Canva',
      description: 'Édite ton design',
      icon: ExternalLink,
      gradient: 'from-blue-400 to-purple-500',
      action: () => {
        toast.success('Ouverture Canva... 🎨');
        window.open('#', '_blank');
      },
    },
    {
      id: 'zip',
      title: 'Télécharger ZIP',
      description: 'Fichiers HD',
      icon: Download,
      gradient: 'from-alfie-mint to-alfie-lilac',
      action: () => toast.success('Téléchargement démarré ! 📦'),
    },
    {
      id: 'texts',
      title: 'Copier textes',
      description: 'Hooks + CTAs',
      icon: copied ? Check : Copy,
      gradient: 'from-alfie-pink to-orange-400',
      action: handleCopyTexts,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen w-full flex items-center justify-center p-4 relative"
    >
      {/* Celebration particles */}
      <ParticleField count={50} speed="normal" />

      <div className="max-w-4xl w-full relative z-10">
        {/* Chest Animation */}
        <motion.div
          initial={{ scale: 0, rotateY: -180 }}
          animate={{ scale: 1, rotateY: 0 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="text-center mb-8"
        >
          <motion.div
            className="inline-block text-8xl sm:text-9xl"
            animate={
              chestOpened && !prefersReducedMotion
                ? {
                    y: [0, -20, 0],
                    rotateZ: [0, -5, 5, 0],
                  }
                : {}
            }
            transition={{ duration: 0.5 }}
          >
            {chestOpened ? '🎁' : '📦'}
          </motion.div>

          {/* Sparkles around chest */}
          {chestOpened && !prefersReducedMotion && (
            <>
              {[...Array(6)].map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute text-2xl"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                    x: Math.cos((i / 6) * Math.PI * 2) * 80,
                    y: Math.sin((i / 6) * Math.PI * 2) * 80 - 60,
                  }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
                  style={{
                    left: '50%',
                    top: '50%',
                  }}
                >
                  ✨
                </motion.span>
              ))}
            </>
          )}
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Loot débloqué ! 🎉
          </h1>
          <p className="text-lg text-muted-foreground">
            Ton pack est prêt. Choisis comment le récupérer.
          </p>
        </motion.div>

        {/* Loot Cards */}
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          {lootCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                whileHover={prefersReducedMotion ? {} : { scale: 1.03, y: -5 }}
                whileTap={{ scale: 0.97 }}
                onClick={card.action}
                className="bg-background/90 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-border/50 text-center group hover:shadow-xl transition-shadow"
              >
                {/* Icon with glow */}
                <motion.div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${card.gradient} mb-4 shadow-lg`}
                  whileHover={prefersReducedMotion ? {} : { rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon className="w-8 h-8 text-white" />
                </motion.div>

                <h3 className="font-bold text-foreground text-lg mb-1">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.description}</p>

                {/* Hover glow effect */}
                <div
                  className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-20 transition-opacity bg-gradient-to-br ${card.gradient} pointer-events-none`}
                />
              </motion.button>
            );
          })}
        </div>

        {/* Secondary Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <Button
            variant="outline"
            onClick={onVariation}
            className="rounded-xl gap-2 bg-background/80"
          >
            <RefreshCw className="w-4 h-4" />
            🔄 Re-roll (variation)
          </Button>
          <Button
            variant="outline"
            onClick={onSavePreset}
            className="rounded-xl gap-2 bg-background/80"
          >
            <Save className="w-4 h-4" />
            💾 Sauvegarder preset
          </Button>
        </motion.div>

        {/* Back to Studio */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center mt-8"
        >
          <a
            href="/studio"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Retour au Studio →
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
}
