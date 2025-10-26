import { useState } from 'react';
import { toast } from 'sonner';
import { adminCreateUser } from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, CheckCircle2 } from 'lucide-react';

const USERS_TO_CREATE = [
  {
    email: 'borderonpatricia7@gmail.com',
    fullName: 'Patricia Borderon',
    password: 'Animaux32021.',
    plan: 'pro' as const,
  },
  {
    email: 'Sandrine.guedra@gmail.com',
    fullName: 'Sandrine Guedra',
    password: 'Sgu54700!',
    plan: 'pro' as const,
  },
];

export default function AdminCreateBulkCustomers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ email: string; success: boolean; error?: string }>>([]);

  async function createAllUsers() {
    setLoading(true);
    const newResults: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const user of USERS_TO_CREATE) {
      try {
        await adminCreateUser({
          email: user.email,
          fullName: user.fullName,
          plan: user.plan,
          sendInvite: false,
          grantedByAdmin: true,
          password: user.password,
        });
        
        newResults.push({ email: user.email, success: true });
        toast.success(`✅ ${user.fullName} créé avec succès`);
      } catch (e: any) {
        const errorMessage = e?.message || 'Erreur inconnue';
        newResults.push({ email: user.email, success: false, error: errorMessage });
        
        // Si l'utilisateur existe déjà, ce n'est pas grave
        if (errorMessage.includes('already') || errorMessage.includes('existe')) {
          toast.info(`ℹ️ ${user.fullName} existe déjà`);
        } else {
          toast.error(`❌ Erreur pour ${user.fullName}: ${errorMessage}`);
        }
      }
    }

    setResults(newResults);
    setLoading(false);

    const successCount = newResults.filter(r => r.success).length;
    if (successCount === USERS_TO_CREATE.length) {
      toast.success('🎉 Tous les comptes ont été créés avec succès !');
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Création groupée de comptes</h1>
          <p className="text-sm text-muted-foreground">
            Créer les comptes pour Patricia et Sandrine
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comptes à créer</CardTitle>
          <CardDescription>
            Ces utilisateurs recevront un plan Pro avec accès manuel (sans Stripe)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {USERS_TO_CREATE.map((user, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div>
                  <p className="font-medium">{user.fullName}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Plan: <span className="font-semibold text-green-600">Pro</span> • 
                    Accès: <span className="font-semibold text-blue-600">Manuel</span>
                  </p>
                </div>
                {results.find(r => r.email === user.email) && (
                  <div>
                    {results.find(r => r.email === user.email)?.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <span className="text-xs text-red-500">
                        {results.find(r => r.email === user.email)?.error}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button
            onClick={createAllUsers}
            className="w-full"
            disabled={loading}
            size="lg"
          >
            {loading ? (
              <>Création en cours...</>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Créer tous les comptes
              </>
            )}
          </Button>

          {results.length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-muted">
              <h3 className="font-semibold mb-2">Résultats:</h3>
              <ul className="space-y-1 text-sm">
                {results.map((result, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                    <span>{result.email}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Informations de connexion
            </h3>
            <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <div>
                <p className="font-medium">Patricia Borderon:</p>
                <p className="font-mono text-xs">borderonpatricia7@gmail.com / Animaux32021.</p>
              </div>
              <div>
                <p className="font-medium">Sandrine Guedra:</p>
                <p className="font-mono text-xs">Sandrine.guedra@gmail.com / Sgu54700!</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
