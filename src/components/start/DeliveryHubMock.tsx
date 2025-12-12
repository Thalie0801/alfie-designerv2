import { motion } from 'framer-motion';
import { ExternalLink, Download, Copy, RefreshCw, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

interface DeliveryHubMockProps {
  onVariation: () => void;
  onSavePreset: () => void;
}

export function DeliveryHubMock({ onVariation, onSavePreset }: DeliveryHubMockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyTexts = () => {
    const mockTexts = `Slide 1: Hook - Attention ! Vous perdez 3h par semaine sur Canva ?
    
Slide 2: Problème - Le design prend du temps. Beaucoup trop de temps.

Slide 3: Solution - Alfie génère vos visuels en 90 secondes.

Slide 4: Preuve - +2000 créateurs utilisent déjà Alfie.

Slide 5: CTA - Testez gratuitement maintenant !`;

    navigator.clipboard.writeText(mockTexts);
    setCopied(true);
    toast.success('Textes copiés !');
    setTimeout(() => setCopied(false), 2000);
  };

  const deliveryCards = [
    {
      id: 'canva',
      title: 'Ouvrir dans Canva',
      description: 'Éditez et personnalisez votre design',
      icon: ExternalLink,
      color: 'from-blue-400 to-purple-500',
      action: () => window.open('#', '_blank'),
      buttonText: 'Ouvrir Canva',
    },
    {
      id: 'zip',
      title: 'Télécharger le ZIP',
      description: 'Tous vos fichiers PNG haute résolution',
      icon: Download,
      color: 'from-alfie-mint to-alfie-lilac',
      action: () => toast.success('Téléchargement démarré (mock)'),
      buttonText: 'Télécharger',
    },
    {
      id: 'texts',
      title: 'Copier les textes',
      description: 'Tous les hooks, titres et CTAs',
      icon: copied ? Check : Copy,
      color: 'from-alfie-pink to-orange-400',
      action: handleCopyTexts,
      buttonText: copied ? 'Copié !' : 'Copier',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #E3FBF9 0%, #FFE4EC 25%, #E8D5FF 50%, #FFD4B8 75%, #FFF9C4 100%)',
      }}
    >
      <div className="max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-alfie-mint to-alfie-lilac rounded-full mb-6"
          >
            <Check className="w-10 h-10 text-white" />
          </motion.div>

          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            C'est prêt ! 🎉
          </h1>
          <p className="text-lg text-muted-foreground">
            Ton pack est généré. Choisis comment le récupérer.
          </p>
        </motion.div>

        {/* Delivery Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {deliveryCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-xl text-center"
              >
                <div
                  className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${card.color} mb-4`}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-foreground mb-1">{card.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{card.description}</p>
                <Button
                  onClick={card.action}
                  className={`w-full rounded-xl ${
                    card.id === 'texts' && copied
                      ? 'bg-alfie-mint text-foreground'
                      : 'bg-gradient-to-r from-alfie-mint to-alfie-lilac text-foreground'
                  }`}
                >
                  {card.buttonText}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Secondary Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <Button
            variant="outline"
            onClick={onVariation}
            className="rounded-xl gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Générer une variation
          </Button>
          <Button
            variant="outline"
            onClick={onSavePreset}
            className="rounded-xl gap-2"
          >
            <Save className="w-4 h-4" />
            Sauvegarder ce preset
          </Button>
        </motion.div>

        {/* Back to Studio Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <a
            href="/studio"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Retour au Studio
          </a>
        </motion.div>
      </div>
    </motion.div>
  );
}
