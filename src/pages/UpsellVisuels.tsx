import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Lock, ArrowLeft, Loader2, Sparkles, Image, Download, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackEvent } from '@/utils/trackEvent';
import logo from '@/assets/alfie-logo-black.svg';

// Price ID pour le pack 30 visuels 19€
const VISUELS_30_PRICE_ID = 'price_1Smf0kQvcbGhgt8SdTqq63t2';

export default function UpsellVisuels() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const brandId = searchParams.get('brandId');
  const sessionId = searchParams.get('session_id');
  const success = searchParams.get('success');

  useEffect(() => {
    trackEvent('upsell_visuels_view', { brandId });
  }, [brandId]);

  // Vérifier le paiement si redirect Stripe
  useEffect(() => {
    if (success === 'true' && sessionId) {
      verifyPayment(sessionId);
    }
  }, [success, sessionId]);

  const verifyPayment = async (sid: string) => {
    setIsVerifying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-upsell-payment', {
        body: { sessionId: sid, brandId },
      });

      if (error) {
        console.error('Verification error:', error);
        toast.error('Erreur lors de la vérification du paiement');
        return;
      }

      if (data?.success) {
        trackEvent('upsell_visuels_paid', { sessionId: sid, amount: 19 });
        toast.success('Paiement confirmé ! Génération en cours...');
        // Rediriger vers la page de livraison
        navigate(`/upsell-visuels/delivery?orderId=${data.orderId}`);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erreur lors de la vérification');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePayment = async () => {
    setIsLoading(true);
    trackEvent('upsell_visuels_checkout_started', { brandId });

    try {
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        toast.error('Tu dois être connecté pour effectuer un achat');
        navigate('/auth?redirect=/upsell-visuels');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          mode: 'payment',
          price_id: VISUELS_30_PRICE_ID,
          purchase_type: 'visuels_pack_30',
          metadata: {
            product: 'visuels_30',
            brandId: brandId,
          },
        },
      });

      if (error) {
        console.error('Checkout error:', error);
        toast.error('Erreur lors de la création du paiement');
        setIsLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('URL de paiement non reçue');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Erreur lors du paiement');
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    trackEvent('upsell_visuels_skipped', { brandId });
    navigate('/library');
  };

  // Vérification en cours
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-alfie-peach/20 via-background to-alfie-lilac/20 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-alfie-mint mx-auto" />
          <h1 className="text-xl font-bold">Vérification du paiement...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-alfie-peach/20 via-background to-alfie-lilac/20">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Retour</span>
          </button>
          <img src={logo} alt="Alfie" className="h-7" />
          <div className="w-16" />
        </div>
      </header>

      <main className="px-4 py-12 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-3xl shadow-lg border border-border overflow-hidden"
        >
          {/* Header avec gradient */}
          <div className="bg-gradient-to-br from-alfie-mint/30 to-alfie-lilac/30 p-8 text-center">
            <Badge className="bg-background/80 text-foreground mb-4">
              🎨 Offre spéciale
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Tu veux publier toute l'année sans repartir de zéro ?
            </h1>
            <p className="text-muted-foreground">
              Débloque 30 visuels réutilisables générés par Alfie, à tes couleurs.
            </p>
          </div>

          {/* Prix */}
          <div className="p-6 text-center border-b border-border">
            <div className="flex items-center justify-center gap-3">
              <span className="text-xl text-muted-foreground line-through">49€</span>
              <span className="text-5xl font-bold text-alfie-mint">19€</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Paiement unique</p>
          </div>

          {/* Bénéfices */}
          <div className="p-6 space-y-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-start gap-4 p-4 rounded-xl bg-muted/50"
            >
              <div className="w-10 h-10 rounded-full bg-alfie-mint/20 flex items-center justify-center shrink-0">
                <Palette className="h-5 w-5 text-alfie-mint" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">5 structures qui convertissent</h3>
                <p className="text-sm text-muted-foreground">
                  Bénéfice, Preuve, Offre, Problème→Solution, Checklist
                </p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-start gap-4 p-4 rounded-xl bg-muted/50"
            >
              <div className="w-10 h-10 rounded-full bg-alfie-lilac/30 flex items-center justify-center shrink-0">
                <Image className="h-5 w-5 text-alfie-lilac" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">30 variations prêtes à poster</h3>
                <p className="text-sm text-muted-foreground">
                  6 variations par structure, toutes à tes couleurs
                </p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-start gap-4 p-4 rounded-xl bg-muted/50"
            >
              <div className="w-10 h-10 rounded-full bg-alfie-pink/20 flex items-center justify-center shrink-0">
                <Download className="h-5 w-5 text-alfie-pink" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Export ZIP immédiat</h3>
                <p className="text-sm text-muted-foreground">
                  Télécharge tout en un clic, organise par structure
                </p>
              </div>
            </motion.div>
          </div>

          {/* Preview des structures */}
          <div className="px-6 pb-6">
          <div className="flex flex-wrap gap-2 justify-center">
              {['Bénéfice', 'Preuve', 'Offre', 'Problème→Solution', 'Checklist'].map((structure) => (
                <Badge 
                  key={structure} 
                  variant="outline" 
                  className="text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  {structure}
                </Badge>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="p-6 bg-muted/30">
            <Button
              size="lg"
              onClick={handlePayment}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-alfie-mint to-alfie-pink text-foreground font-bold h-14 text-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Redirection...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Oui, je veux le pack (19€)
                </>
              )}
            </Button>
            
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Paiement sécurisé par Stripe</span>
            </div>

            <button
              onClick={handleSkip}
              className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors"
            >
              Non merci, continuer →
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
