import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Download, Copy, RefreshCw, Save, Check, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ParticleField } from '../game/ParticleField';
import { downloadAssetsAsZip } from '@/lib/downloadZip';
import type { GeneratedAsset } from '@/lib/types/startFlow';

interface LootChestSceneProps {
  assets: GeneratedAsset[];
  onVariation: () => void;
  onSavePreset: () => void;
}

export function LootChestScene({ assets, onVariation, onSavePreset }: LootChestSceneProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [chestOpened, setChestOpened] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Auto-open chest after mount
  useState(() => {
    const timer = setTimeout(() => setChestOpened(true), 500);
    return () => clearTimeout(timer);
  });

  const handleDownloadZip = async () => {
    if (downloading) return;
    setDownloading(true);
    
    try {
      await downloadAssetsAsZip(
        assets.map(a => ({ title: a.title, url: a.url })),
        'alfie-pack.zip'
      );
      toast.success('Pack téléchargé ! 📦');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  };

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

  const handleUpsellClick = () => {
    // Redirect to checkout page with template product
    window.location.href = '/checkout-express?product=templates-canva&price=19';
  };

  const hasRealAssets = assets.some(a => !a.url.startsWith('/images/'));

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
            {hasRealAssets 
              ? 'Tes visuels sont prêts. Télécharge-les maintenant !'
              : 'Ton pack est prêt. Choisis comment le récupérer.'}
          </p>
        </motion.div>

        {/* Generated Assets Preview */}
        {hasRealAssets && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-3 gap-3 sm:gap-4 mb-8"
          >
            {assets.map((asset, index) => (
              <motion.div
                key={asset.title}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="relative group"
              >
                <div className="aspect-square bg-muted rounded-2xl overflow-hidden border border-border/50">
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/hero-preview.jpg';
                    }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground mt-2">{asset.title}</p>
                
                {/* Hover overlay with open button */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                  >
                    <ExternalLink className="w-5 h-5 text-white" />
                  </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col sm:flex-row justify-center gap-4 mb-8"
        >
          <Button
            onClick={handleDownloadZip}
            disabled={downloading}
            size="lg"
            className="gap-2 bg-gradient-to-r from-alfie-mint to-alfie-lilac text-foreground font-bold rounded-xl"
          >
            <Download className="w-5 h-5" />
            {downloading ? 'Téléchargement...' : 'Télécharger ZIP'}
          </Button>
          
          <Button
            onClick={handleCopyTexts}
            variant="outline"
            size="lg"
            className="gap-2 rounded-xl"
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? 'Copié !' : 'Copier textes'}
          </Button>
        </motion.div>

        {/* Secondary Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap justify-center gap-3 mb-8"
        >
          <Button
            variant="ghost"
            onClick={onVariation}
            className="rounded-xl gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Re-roll (variation)
          </Button>
          <Button
            variant="ghost"
            onClick={onSavePreset}
            className="rounded-xl gap-2"
          >
            <Save className="w-4 h-4" />
            Sauvegarder preset
          </Button>
        </motion.div>

        {/* UPSELL Templates 19€ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="p-6 rounded-2xl border-2 border-alfie-mint/50 bg-gradient-to-r from-alfie-mint/10 to-alfie-lilac/10 mb-8"
        >
          <div className="text-center mb-4">
            <span className="inline-block px-3 py-1 rounded-full bg-alfie-mint/20 text-sm font-medium mb-2">
              🎁 Offre spéciale
            </span>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Pack Templates Canva Pro
            </h3>
            <p className="text-muted-foreground text-sm">
              50+ templates personnalisables avec tes couleurs et typos
            </p>
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
            Débloquer les templates
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-2">
            Paiement sécurisé · Accès immédiat
          </p>
        </motion.div>

        {/* Back to Studio */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center"
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
