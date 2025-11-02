import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface BrandDialogProps {
  brand?: any;
  onSuccess: () => void;
  children?: React.ReactNode;
}

export function BrandDialog({ brand, onSuccess, children }: BrandDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quotaReached, setQuotaReached] = useState(false);
  const [formData, setFormData] = useState({
    name: brand?.name || '',
    logo_url: brand?.logo_url || '',
    voice: brand?.voice || '',
    font_primary: brand?.fonts?.primary || '',
    font_secondary: brand?.fonts?.secondary || ''
  });

  // ✅ Vérifier le quota au chargement
  useEffect(() => {
    const checkQuota = async () => {
      if (!user || brand) return; // Skip si édition
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('quota_brands')
        .eq('id', user.id)
        .single();

      const { count: currentBrands } = await supabase
        .from('brands')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const maxAllowedBrands = profileData?.quota_brands || 1;
      setQuotaReached((currentBrands || 0) >= maxAllowedBrands);
    };
    
    checkQuota();
  }, [user, brand, open]);

  const handleOpen = () => {
    if (quotaReached && !brand) {
      toast.error('Limite de marques atteinte. Utilisez le bouton "Ajouter une marque + 39€"', {
        duration: 5000
      });
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      toast.error('Le nom de la marque est requis');
      return;
    }

    setLoading(true);
    try {
      if (brand?.id) {
        // Update existing brand
        const { error } = await supabase
          .from('brands')
          .update({
            name: formData.name,
            logo_url: formData.logo_url || null,
            voice: formData.voice || null,
            fonts: {
              primary: formData.font_primary || null,
              secondary: formData.font_secondary || null
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', brand.id)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Marque mise à jour !');
      } else {
        // CHECK QUOTA BEFORE CREATING - Vérifier quota_brands depuis profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('quota_brands')
          .eq('id', user.id)
          .single();

        const { count: currentBrands } = await supabase
          .from('brands')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        const maxAllowedBrands = profile?.quota_brands || 1;
        
        if ((currentBrands || 0) >= maxAllowedBrands) {
          toast.error(`Vous avez atteint votre limite de ${maxAllowedBrands} marque(s). Pour ajouter une marque supplémentaire, utilisez le bouton "Ajouter une marque + 39€".`);
          setLoading(false);
          return;
        }

        // Create new brand
        const { error } = await supabase
          .from('brands')
          .insert({
            user_id: user.id,
            name: formData.name,
            logo_url: formData.logo_url || null,
            voice: formData.voice || null,
            fonts: {
              primary: formData.font_primary || null,
              secondary: formData.font_secondary || null
            },
            palette: []
          });

        if (error) throw error;
        toast.success('Marque créée !');
      }

      setOpen(false);
      setFormData({ name: '', logo_url: '', voice: '', font_primary: '', font_secondary: '' });
      onSuccess();
    } catch (error: any) {
      console.error('Error saving brand:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={handleOpen}>
        {children ? children : brand ? (
          <Button variant="outline" size="sm">
            Modifier
          </Button>
        ) : (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {brand ? 'Modifier la marque' : 'Nouvelle marque'}
          </DialogTitle>
          <DialogDescription>
            {brand
              ? 'Modifiez les informations de votre marque'
              : 'Créez une nouvelle marque pour vos visuels'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de la marque *</Label>
            <Input
              id="name"
              placeholder="Ma super marque"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo_url">URL du logo</Label>
            <Input
              id="logo_url"
              type="url"
              placeholder="https://..."
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Lien vers votre logo (optionnel)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="font_primary">Police principale</Label>
            <Input
              id="font_primary"
              placeholder="Ex: Montserrat, Inter, Roboto..."
              value={formData.font_primary || ''}
              onChange={(e) => setFormData({ ...formData, font_primary: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="font_secondary">Police secondaire</Label>
            <Input
              id="font_secondary"
              placeholder="Ex: Open Sans, Lato..."
              value={formData.font_secondary || ''}
              onChange={(e) => setFormData({ ...formData, font_secondary: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Police pour les textes secondaires (optionnel)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice">Voix de marque</Label>
            <Textarea
              id="voice"
              placeholder="Ex: Ton professionnel, dynamique, bienveillant..."
              value={formData.voice}
              onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Décrivez le ton et le style de communication de votre marque
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
