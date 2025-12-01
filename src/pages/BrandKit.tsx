import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBrandKit } from '@/hooks/useBrandKit';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Palette, Save, Loader2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { BrandSelector } from '@/components/BrandSelector';

export default function BrandKit() {
  const { user } = useAuth();
  const { brandKit, loadBrands } = useBrandKit();
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    niche: '',
    voice: '',
    font_primary: '',
    font_secondary: '',
    colors: [] as string[]
  });

  // Load brand data into form only when brand ID changes
  useEffect(() => {
    if (brandKit) {
      const colors = Array.isArray(brandKit.palette) 
        ? brandKit.palette.map(c => {
            if (typeof c === 'string') {
              const cleaned = c.trim().replace(/["'\\]/g, "");
              const hex = cleaned.startsWith("#") ? cleaned : "#" + cleaned;
              return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.toUpperCase() : '#000000';
            }
            return '#000000';
          })
        : [];

      setFormData({
        name: brandKit.name || '',
        logo_url: brandKit.logo_url || '',
        niche: brandKit.niche || '',
        voice: brandKit.voice || '',
        font_primary: brandKit.fonts?.primary || '',
        font_secondary: brandKit.fonts?.secondary || '',
        colors
      });
    }
  }, [brandKit?.id]); // Only reload when brand ID changes, not on every brandKit update

  const handleAddColor = () => {
    if (formData.colors.length < 5) {
      setFormData({ ...formData, colors: [...formData.colors, '#000000'] });
    }
  };

  const handleColorChange = (index: number, value: string) => {
    const cleaned = value.trim().replace(/["'\\]/g, "");
    const withHash = /^[0-9A-Fa-f]{6}$/.test(cleaned) ? "#" + cleaned : cleaned;
    const newColors = [...formData.colors];
    newColors[index] = withHash.toUpperCase();
    setFormData({ ...formData, colors: newColors });
  };

  const handleRemoveColor = (index: number) => {
    const newColors = formData.colors.filter((_, i) => i !== index);
    setFormData({ ...formData, colors: newColors });
  };

  const handleSave = async () => {
    if (!brandKit?.id || !user) return;

    if (!formData.name.trim()) {
      toast.error('Le nom de la marque est requis');
      return;
    }

    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    const invalidColors = formData.colors.filter(c => c && !hexRegex.test(c));
    
    if (invalidColors.length > 0) {
      toast.error('Certaines couleurs sont invalides. Utilisez le format #RRGGBB');
      return;
    }

    setLoading(true);
    setSaveStatus('saving');

    try {
      const { error } = await supabase
        .from('brands')
        .update({
          name: formData.name,
          logo_url: formData.logo_url || null,
          niche: formData.niche || null,
          voice: formData.voice || null,
          palette: formData.colors,
          fonts: {
            primary: formData.font_primary || null,
            secondary: formData.font_secondary || null
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', brandKit.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setSaveStatus('saved');
      toast.success('Ta marque a bien été mise à jour 🐶');
      await loadBrands();
      
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error('Alfie n\'a pas pu mettre à jour ta marque. Réessaie dans quelques instants.');
      setSaveStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  if (!brandKit) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Brand Kit</CardTitle>
            <CardDescription>
              Aucune marque active. Crée une marque pour commencer.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header with brand selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Mon Brand Kit</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Configure les couleurs, polices et ton de ta marque
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <BrandSelector />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            <CardTitle>Identité de marque</CardTitle>
          </div>
          <CardDescription>
            Personnalise les éléments visuels et le ton de ta marque
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nom de la marque */}
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

          {/* Logo URL */}
          <div className="space-y-2">
            <Label htmlFor="logo_url">URL du logo</Label>
            <Input
              id="logo_url"
              type="url"
              placeholder="https://..."
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
            />
            {formData.logo_url && (
              <div className="mt-2 p-4 border rounded-lg bg-muted/30">
                <img
                  src={formData.logo_url}
                  alt="Logo preview"
                  className="h-20 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Lien vers votre logo (optionnel)
            </p>
          </div>

          {/* Niche */}
          <div className="space-y-2">
            <Label htmlFor="niche">Niche / Secteur d'activité</Label>
            <Input
              id="niche"
              placeholder="Ex: Coaching en développement personnel, E-commerce mode..."
              value={formData.niche}
              onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Le secteur ou la thématique principale de votre marque
            </p>
          </div>

          {/* Palette de couleurs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Palette de couleurs</Label>
              {formData.colors.length < 5 && (
                <Button type="button" size="sm" variant="outline" onClick={handleAddColor}>
                  + Ajouter
                </Button>
              )}
            </div>
            {formData.colors.length === 0 ? (
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Aucune couleur définie. Ajoute jusqu'à 5 couleurs pour ta marque.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.colors.map((color, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color.match(/^#[0-9A-Fa-f]{6}$/) ? color : '#000000'}
                      onChange={(e) => handleColorChange(index, e.target.value)}
                      className="h-10 w-16 rounded border cursor-pointer"
                    />
                    <Input
                      value={color}
                      onChange={(e) => handleColorChange(index, e.target.value)}
                      placeholder="#000000"
                      className="flex-1 font-mono"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveColor(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Définissez jusqu'à 5 couleurs principales de votre marque
            </p>
          </div>

          {/* Polices */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="font_primary">Police principale</Label>
              <Input
                id="font_primary"
                placeholder="Ex: Montserrat, Inter..."
                value={formData.font_primary}
                onChange={(e) => setFormData({ ...formData, font_primary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="font_secondary">Police secondaire</Label>
              <Input
                id="font_secondary"
                placeholder="Ex: Open Sans, Lato..."
                value={formData.font_secondary}
                onChange={(e) => setFormData({ ...formData, font_secondary: e.target.value })}
              />
            </div>
          </div>

          {/* Voix de marque */}
          <div className="space-y-2">
            <Label htmlFor="voice">Voix de marque</Label>
            <Textarea
              id="voice"
              placeholder="Ex: Ton professionnel, dynamique, bienveillant..."
              value={formData.voice}
              onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Décrivez le ton et le style de communication de votre marque
            </p>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={loading || !formData.name.trim()}
              className="gap-2"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sauvegarde en cours...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Sauvegarder les modifications
                </>
              )}
            </Button>
            {saveStatus === 'saved' && (
              <span className="text-sm font-medium text-green-600">
                ✓ Sauvegardé
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
