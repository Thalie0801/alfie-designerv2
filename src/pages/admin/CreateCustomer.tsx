import { ChangeEvent, FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { adminCreateUser } from '@/lib/admin-api';
import { ALL_PLANS, Plan } from '@/lib/plans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function AdminCreateCustomerPage() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [plan, setPlan] = useState<Plan>('starter');
  const [sendInvite, setSendInvite] = useState(true);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !plan) return toast.error('Email et plan requis');

    if (!sendInvite && !password) {
      return toast.error("Mot de passe requis si l'invitation n'est pas envoyée");
    }

    setLoading(true);
    try {
      await adminCreateUser({
        email,
        fullName,
        plan,
        sendInvite,
        password: sendInvite ? undefined : password,
      });
      toast.success('Utilisateur créé et plan appliqué ✅');
      setEmail('');
      setFullName('');
      setPlan('starter');
      setSendInvite(true);
      setPassword('');
    } catch (e: any) {
      toast.error(e?.message || 'Échec de la création');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Créer un client</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <Label>Nom complet (optionnel)</Label>
              <Input
                value={fullName}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFullName(event.target.value)}
                placeholder="Nom prénom"
              />
            </div>

            <div>
              <Label>Plan</Label>
              <Select value={plan} onValueChange={(value: Plan) => setPlan(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un plan" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PLANS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="invite">Envoyer une invitation email</Label>
              <Switch id="invite" checked={sendInvite} onCheckedChange={(value) => setSendInvite(Boolean(value))} />
            </div>

            {!sendInvite && (
              <div>
                <Label>Mot de passe (si pas d'invitation)</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Création…' : "Créer l'utilisateur"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
