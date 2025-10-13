import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Moon, CreditCard, Handshake } from 'lucide-react';
import { useAlfieCredits } from '@/hooks/useAlfieCredits';
import { CreditPurchaseDialog } from './CreditPurchaseDialog';

export function CreditBalance() {
  const { credits, totalCredits, generations, loading } = useAlfieCredits();

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Zap className="h-5 w-5 text-yellow-500" />
          Crédits IA
          <Badge className="ml-auto bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 text-lg">
            {totalCredits}
          </Badge>
        </CardTitle>
        <CardDescription>
          {generations} générations ce mois-ci • Images: 1 crédit • Vidéos: 2 crédits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Mensuels</span>
            </div>
            <span className="text-blue-600 dark:text-blue-400 font-bold">{credits.monthly}</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">Achetés</span>
            </div>
            <span className="text-green-600 dark:text-green-400 font-bold">{credits.purchased}</span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
            <div className="flex items-center gap-2">
              <Handshake className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Affiliation</span>
            </div>
            <span className="text-purple-600 dark:text-purple-400 font-bold">{credits.affiliation}</span>
          </div>
        </div>

        <div className="pt-2">
          <CreditPurchaseDialog />
        </div>
      </CardContent>
    </Card>
  );
}
