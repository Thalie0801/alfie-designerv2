import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Shield, FileArchive, FileText, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Intent } from '@/lib/types/startFlow';

interface EmailGateSceneProps {
  intent: Intent;
  onContinue: (email?: string) => void;
}

export function EmailGateScene({ intent, onContinue }: EmailGateSceneProps) {
  const [email, setEmail] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSaveAndContinue = async () => {
    if (!validateEmail(email)) {
      setError('Entre une adresse email valide');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Call capture-lead edge function
      const { data, error: fnError } = await supabase.functions.invoke('capture-lead', {
        body: {
          email: email.trim().toLowerCase(),
          intent,
          marketingOptIn,
          source: 'start_game',
        },
      });

      if (fnError) throw fnError;

      // Store in localStorage
      localStorage.setItem('alfie-lead-email', email);
      localStorage.setItem('alfie-lead-id', data?.lead_id || '');

      toast.success('Partie sauvegardée ! 🎮');
      onContinue(email);
    } catch (err) {
      console.error('Error capturing lead:', err);
      // Continue anyway but log error
      toast.error('Erreur de sauvegarde, mais on continue !');
      onContinue(email);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    onContinue();
  };

  const benefits = [
    { icon: FileArchive, text: 'ZIP HD prêt à poster', color: 'text-emerald-400' },
    { icon: FileText, text: 'Textes CSV pour Canva', color: 'text-sky-400' },
    { icon: Mail, text: 'Email de livraison', color: 'text-amber-400' },
  ];

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      {/* Checkpoint card */}
      <motion.div
        className="w-full max-w-md"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {/* Glowing border effect */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-rose-400 to-purple-400 rounded-3xl blur-lg opacity-40 animate-pulse" />
          
          <div className="relative bg-card/95 backdrop-blur-xl rounded-2xl border border-border/50 p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Sauvegarder ta partie ?</h2>
                <p className="text-sm text-muted-foreground">Débloquer ton coffre 🔓</p>
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-3 mb-6">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.text}
                  className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/30"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <div className={`w-8 h-8 rounded-lg bg-background flex items-center justify-center ${benefit.color}`}>
                    <benefit.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{benefit.text}</span>
                  <Sparkles className="w-4 h-4 text-amber-400 ml-auto" />
                </motion.div>
              ))}
            </div>

            {/* Email input */}
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="ton@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className="pl-10 h-12 bg-background/80 border-border/50 rounded-xl text-base"
                />
              </div>
              
              {error && (
                <motion.p
                  className="text-sm text-destructive"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.p>
              )}

              {/* Marketing opt-in */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <Checkbox
                  checked={marketingOptIn}
                  onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  J'accepte de recevoir des conseils et astuces (optionnel)
                </span>
              </label>

              {/* Primary button */}
              <Button
                onClick={handleSaveAndContinue}
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-lg shadow-amber-500/25"
              >
                {isLoading ? (
                  <motion.div
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <>
                    💾 Sauvegarder & continuer
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              {/* Skip button */}
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                ⏭️ Continuer sans sauvegarder
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-amber-400/30"
            style={{
              left: `${20 + Math.random() * 60}%`,
              top: `${20 + Math.random() * 60}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
