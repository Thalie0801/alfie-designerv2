import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseSafeClient';

export default function ResetUserPassword() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Email et mot de passe requis');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-user-password', {
        body: { email, password }
      });

      if (error) throw error;

      toast.success(data.message || 'Mot de passe réinitialisé avec succès');
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Réinitialiser le mot de passe utilisateur</CardTitle>
          <CardDescription>
            Permet de définir un nouveau mot de passe pour un utilisateur existant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email de l'utilisateur</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="utilisateur@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                required
              />
              <p className="text-xs text-muted-foreground">
                Le mot de passe sera défini tel quel (pas de hachage côté client)
              </p>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-md">
            <h4 className="font-medium mb-2">Comptes VIP à réinitialiser :</h4>
            <ul className="space-y-1 text-sm">
              <li>• borderonpatricia7@gmail.com → Animaux32021.</li>
              <li>• sandrine.guedra54@gmail.com → Sgu54700!</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
