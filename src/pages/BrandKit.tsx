import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useBrandKit, ToneSliders } from '@/hooks/useBrandKit';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Palette, Save, Loader2, X, MessageSquare, Eye, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { BrandSelector } from '@/components/BrandSelector';
import { cn } from '@/lib/utils';

// Predefined lists
const ADJECTIVES_LIST = [
  'chaleureux', 'premium', 'fun', 'sérieux', 'pédagogique', 'punchy',
  'inspirant', 'accessible', 'expert', 'dynamique', 'rassurant', 'audacieux'
];

const VISUAL_TYPES = [
  { value: 'illustrations_2d', label: 'Illustrations 2D' },
  { value: 'illustrations_3d', label: 'Illustrations 3D' },
  { value: 'photos', label: 'Photos réalistes' },
  { value: 'mockups', label: 'Mockups produits' },
  { value: 'doodle', label: 'Style doodle/croquis' },
  { value: 'corporate', label: 'Style corporate' }
];

const VISUAL_MOODS = [
  { value: 'colore', label: 'Coloré' },
  { value: 'minimaliste', label: 'Minimaliste' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'contraste', label: 'Très contrasté' },
  { value: 'lumineux', label: 'Lumineux' },
  { value: 'sombre', label: 'Sombre' }
];

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
    colors: [] as string[],
    // V2 fields
    pitch: '',
    adjectives: [] as string[],
    tone_sliders: { fun: 5, accessible: 5, energetic: 5, direct: 5 } as ToneSliders,
    person: 'tu' as 'je' | 'nous' | 'tu' | 'vous',
    language_level: 'courant' as 'familier' | 'courant' | 'soutenu',
    visual_types: [] as string[],
    visual_mood: [] as string[],
    avoid_in_visuals: '',
    tagline: ''
  });

  // Load brand data into form
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
        colors,
        pitch: brandKit.pitch || '',
        adjectives: brandKit.adjectives || [],
        tone_sliders: brandKit.tone_sliders || { fun: 5, accessible: 5, energetic: 5, direct: 5 },
        person: brandKit.person || 'tu',
        language_level: brandKit.language_level || 'courant',
        visual_types: brandKit.visual_types || [],
        visual_mood: brandKit.visual_mood || [],
        avoid_in_visuals: brandKit.avoid_in_visuals || '',
        tagline: brandKit.tagline || ''
      });
    }
  }, [brandKit?.id]);

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

  const toggleAdjective = (adj: string) => {
    if (formData.adjectives.includes(adj)) {
      setFormData({ ...formData, adjectives: formData.adjectives.filter(a => a !== adj) });
    } else if (formData.adjectives.length < 3) {
      setFormData({ ...formData, adjectives: [...formData.adjectives, adj] });
    }
  };

  const toggleVisualType = (type: string) => {
    if (formData.visual_types.includes(type)) {
      setFormData({ ...formData, visual_types: formData.visual_types.filter(t => t !== type) });
    } else {
      setFormData({ ...formData, visual_types: [...formData.visual_types, type] });
    }
  };

  const toggleVisualMood = (mood: string) => {
    if (formData.visual_mood.includes(mood)) {
      setFormData({ ...formData, visual_mood: formData.visual_mood.filter(m => m !== mood) });
    } else {
      setFormData({ ...formData, visual_mood: [...formData.visual_mood, mood] });
    }
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
          pitch: formData.pitch || null,
          adjectives: formData.adjectives,
          tone_sliders: formData.tone_sliders as { fun: number; accessible: number; energetic: number; direct: number },
          person: formData.person,
          language_level: formData.language_level,
          visual_types: formData.visual_types,
          visual_mood: formData.visual_mood,
          avoid_in_visuals: formData.avoid_in_visuals || null,
          tagline: formData.tagline || null,
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

      {/* Card 1: Identité de marque */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            <CardTitle>Identité de marque</CardTitle>
          </div>
          <CardDescription>
            Les fondamentaux de ton identité visuelle
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
          </div>

          {/* Pitch */}
          <div className="space-y-2">
            <Label htmlFor="pitch">Pitch en 1 phrase</Label>
            <Textarea
              id="pitch"
              placeholder="Explique ta marque en une phrase simple. Ex: 'Plateforme de création de contenus marketing assistée par IA pour freelances et petites marques.'"
              value={formData.pitch}
              onChange={(e) => setFormData({ ...formData, pitch: e.target.value })}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Cette phrase aide l'IA à comprendre ton positionnement
            </p>
          </div>

          {/* Adjectifs */}
          <div className="space-y-3">
            <Label>3 adjectifs de marque</Label>
            <p className="text-xs text-muted-foreground">
              Choisis 3 mots qui décrivent ta marque ({formData.adjectives.length}/3)
            </p>
            <div className="flex flex-wrap gap-2">
              {ADJECTIVES_LIST.map((adj) => (
                <Badge
                  key={adj}
                  variant={formData.adjectives.includes(adj) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all hover:scale-105",
                    formData.adjectives.includes(adj) && "bg-primary text-primary-foreground",
                    !formData.adjectives.includes(adj) && formData.adjectives.length >= 3 && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => toggleAdjective(adj)}
                >
                  {adj}
                </Badge>
              ))}
            </div>
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
        </CardContent>
      </Card>

      {/* Card 2: Voix & Ton */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Voix & Ton</CardTitle>
          </div>
          <CardDescription>
            Comment ta marque s'exprime et communique
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tone sliders */}
          <div className="space-y-6">
            <Label>Curseurs de ton</Label>
            
            {/* Fun ↔ Sérieux */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Fun 😄</span>
                <span>Sérieux 🧠</span>
              </div>
              <Slider
                value={[formData.tone_sliders.fun]}
                onValueChange={([v]) => setFormData({ 
                  ...formData, 
                  tone_sliders: { ...formData.tone_sliders, fun: v } 
                })}
                max={10}
                step={1}
                className="w-full"
              />
            </div>

            {/* Accessible ↔ Corporate */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Accessible 🧸</span>
                <span>Corporate 🏢</span>
              </div>
              <Slider
                value={[formData.tone_sliders.accessible]}
                onValueChange={([v]) => setFormData({ 
                  ...formData, 
                  tone_sliders: { ...formData.tone_sliders, accessible: v } 
                })}
                max={10}
                step={1}
                className="w-full"
              />
            </div>

            {/* Énergique ↔ Calme */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Énergique ⚡</span>
                <span>Calme 🌙</span>
              </div>
              <Slider
                value={[formData.tone_sliders.energetic]}
                onValueChange={([v]) => setFormData({ 
                  ...formData, 
                  tone_sliders: { ...formData.tone_sliders, energetic: v } 
                })}
                max={10}
                step={1}
                className="w-full"
              />
            </div>

            {/* Direct ↔ Nuancé */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Direct 🗣</span>
                <span>Nuancé 🧩</span>
              </div>
              <Slider
                value={[formData.tone_sliders.direct]}
                onValueChange={([v]) => setFormData({ 
                  ...formData, 
                  tone_sliders: { ...formData.tone_sliders, direct: v } 
                })}
                max={10}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* Personne utilisée */}
          <div className="space-y-3">
            <Label>Personne utilisée dans les textes</Label>
            <RadioGroup
              value={formData.person}
              onValueChange={(v) => setFormData({ ...formData, person: v as typeof formData.person })}
              className="flex flex-wrap gap-4"
            >
              {[
                { value: 'je', label: '"Je" (je, mon, mes...)' },
                { value: 'nous', label: '"Nous" (nous, notre...)' },
                { value: 'tu', label: '"Tu" (tu, ton, tes...)' },
                { value: 'vous', label: '"Vous" (vous, votre...)' }
              ].map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`person-${opt.value}`} />
                  <Label htmlFor={`person-${opt.value}`} className="cursor-pointer">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Niveau de langage */}
          <div className="space-y-3">
            <Label>Niveau de langage</Label>
            <RadioGroup
              value={formData.language_level}
              onValueChange={(v) => setFormData({ ...formData, language_level: v as typeof formData.language_level })}
              className="flex flex-wrap gap-4"
            >
              {[
                { value: 'familier', label: 'Familier' },
                { value: 'courant', label: 'Courant' },
                { value: 'soutenu', label: 'Soutenu' }
              ].map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`lang-${opt.value}`} />
                  <Label htmlFor={`lang-${opt.value}`} className="cursor-pointer">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Voix de marque */}
          <div className="space-y-2">
            <Label htmlFor="voice">Voix de marque</Label>
            <Textarea
              id="voice"
              placeholder="Décris la personnalité de ta marque (ex : fun mais pro, rassurante, experte mais accessible…) ; précise comment tu parles à ton audience."
              value={formData.voice}
              onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Style visuel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <CardTitle>Style visuel</CardTitle>
          </div>
          <CardDescription>
            Tes préférences pour les images et vidéos générées
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Types de visuels */}
          <div className="space-y-3">
            <Label>Styles préférés</Label>
            <div className="flex flex-wrap gap-2">
              {VISUAL_TYPES.map((type) => (
                <Badge
                  key={type.value}
                  variant={formData.visual_types.includes(type.value) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all hover:scale-105",
                    formData.visual_types.includes(type.value) && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => toggleVisualType(type.value)}
                >
                  {type.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Ambiance */}
          <div className="space-y-3">
            <Label>Ambiance générale</Label>
            <div className="flex flex-wrap gap-2">
              {VISUAL_MOODS.map((mood) => (
                <Badge
                  key={mood.value}
                  variant={formData.visual_mood.includes(mood.value) ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-all hover:scale-105",
                    formData.visual_mood.includes(mood.value) && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => toggleVisualMood(mood.value)}
                >
                  {mood.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* À éviter */}
          <div className="space-y-2">
            <Label htmlFor="avoid_in_visuals">À éviter</Label>
            <Textarea
              id="avoid_in_visuals"
              placeholder="Ce que tu ne veux jamais voir dans tes visuels (ex : noir total, rouge agressif, personnages trop cartoon...)"
              value={formData.avoid_in_visuals}
              onChange={(e) => setFormData({ ...formData, avoid_in_visuals: e.target.value })}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Exemples */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <CardTitle>Exemples</CardTitle>
          </div>
          <CardDescription>
            Ta phrase type / tagline de référence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              placeholder='Ex: "Crée comme un DA, en 2 clics"'
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Ta phrase type qui résume l'esprit de ta marque
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2 pb-8">
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
    </div>
  );
}
