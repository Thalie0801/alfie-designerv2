import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Mail, Check, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ParticleField } from '../game/ParticleField';
import { supabase } from '@/integrations/supabase/client';
import type { GeneratedAsset } from '@/lib/types/startFlow';

interface LootChestSceneProps {
  assets?: GeneratedAsset[];
  onVariation?: () => void;
  onSavePreset?: () => void;
}

export function LootChestScene(_props: LootChestSceneProps) {
  const [chestOpened, setChestOpened] = useState(false);
  const [resending, setResending] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Auto-open chest after mount
  useState(() => {
    const timer = setTimeout(() => setChestOpened(true), 500);
    return () => clearTimeout(timer);
  });

  const handleResendEmail = async () => {
    if (resending) return;
    setResending(true);
    
    try {
      const email = localStorage.getItem('alfie-lead-email');
      if (!email) {
        toast.error("Email introuvable. Contacte-nous !");
        return;
      }

      const { error } = await supabase.functions.invoke('resend-delivery-email', {
        body: { email }
      });

      if (error) throw error;
      toast.success("Email renvoyé ! Vérifie ta boîte mail 📬");
    } catch (error) {
      console.error('Resend error:', error);
      toast.error("Erreur lors de l'envoi. Réessaie dans quelques secondes.");
    } finally {
      setResending(false);
    }
  };

  const handleUpsellClick = () => {
    const brandId = localStorage.getItem('alfie-active-brand-id') || '';
    window.location.href = `/upsell-visuels?brandId=${brandId}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen w-full flex items-center justify-center p-4 relative"
    >
      {/* Celebration particles */}
      <ParticleField count={50} speed="normal" />

      <div className="max-w-lg w-full relative z-10">
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

        {/* Title & Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Ton pack est en route ! 🎉
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            📬 Un email avec ton lien de téléchargement t'a été envoyé.<br />
            <span className="text-sm">Vérifie tes spams si tu ne le vois pas !</span>
          </p>

          <Button
            onClick={handleResendEmail}
            disabled={resending}
            variant="outline"
            className="gap-2 rounded-xl"
          >
            {resending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {resending ? 'Envoi en cours...' : 'Renvoyer l\'email'}
          </Button>
        </motion.div>

        {/* UPSELL Templates 19€ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="p-6 rounded-2xl border-2 border-alfie-mint/50 bg-gradient-to-r from-alfie-mint/10 to-alfie-lilac/10"
        >
          <div className="text-center mb-4">
            <span className="inline-block px-3 py-1 rounded-full bg-alfie-mint/20 text-sm font-medium mb-2">
              🎨 Offre spéciale
            </span>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Tu veux publier toute l'année sans repartir de zéro ?
            </h3>
            <p className="text-muted-foreground text-sm">
              Débloque 30 visuels réutilisables générés par Alfie, à tes couleurs.
            </p>
          </div>
          
          {/* Bullets */}
          <div className="space-y-2 mb-4 text-left max-w-xs mx-auto">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-alfie-mint" />
              <span>5 structures qui convertissent</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-alfie-mint" />
              <span>30 variations prêtes à poster</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-alfie-mint" />
              <span>Export ZIP immédiat</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-lg text-muted-foreground line-through">49€</span>
            <span className="text-3xl font-bold text-alfie-mint">19€</span>
          </div>
          
          <Button
            onClick={handleUpsellClick}
            className="w-full gap-2 bg-gradient-to-r from-alfie-mint to-alfie-pink text-foreground font-bold"
          >
            <Sparkles className="w-4 h-4" />
            Oui, je veux le pack (19€)
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-2">
            Paiement sécurisé · Accès immédiat
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
