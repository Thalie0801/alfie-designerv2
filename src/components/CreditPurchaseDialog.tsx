import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Coins } from 'lucide-react';
import { useCreditPacks } from '@/hooks/useCreditPacks';
import { useAuth } from '@/hooks/useAuth';

export function CreditPurchaseDialog() {
  const { packs, loading, purchasePack } = useCreditPacks();
  const { profile } = useAuth();

  const isEligibleForDiscount = profile?.plan === 'studio' || profile?.plan === 'pro';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2" size="lg">
          <Coins className="h-5 w-5" />
          Acheter des crédits
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Packs de crédits IA
          </DialogTitle>
          <DialogDescription>
            Achetez des crédits pour générer des visuels personnalisés avec l'IA
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {packs.map((pack) => {
            const priceEur = pack.price_cents / 100;
            const hasDiscount = isEligibleForDiscount && pack.name === 'Pack 50 crédits';
            const finalPrice = hasDiscount 
              ? priceEur * (1 - pack.discount_percentage / 100)
              : priceEur;
            const pricePerCredit = (finalPrice / pack.credits).toFixed(2);

            return (
              <Card key={pack.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{pack.name}</CardTitle>
                    {hasDiscount && (
                      <Badge className="bg-green-600 text-white">
                        -{pack.discount_percentage}%
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">
                      {finalPrice.toFixed(2)}€
                    </span>
                    {hasDiscount && (
                      <span className="text-sm line-through ml-2 text-muted-foreground">
                        {priceEur.toFixed(2)}€
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                      <span className="font-medium">💎 Crédits:</span>
                      <span className="text-xl font-bold text-primary">{pack.credits}</span>
                    </div>
                    <div className="text-sm text-muted-foreground text-center">
                      {pricePerCredit}€ par crédit
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={loading}
                    onClick={() => purchasePack(pack.id)}
                  >
                    {loading ? 'Chargement...' : `Acheter ${pack.credits} crédits`}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {isEligibleForDiscount && (
          <div className="mt-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300">
              🎉 En tant qu'abonné {profile?.plan}, tu bénéficies de -20% sur le pack 50 crédits !
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
