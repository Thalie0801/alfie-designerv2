import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useBrandKit, ToneSliders } from '@/hooks/useBrandKit';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Palette, Save, Loader2, X, MessageSquare, Eye, Sparkles, Type, Upload, Trash2, Link, User } from 'lucide-react';
import { SubjectPackSelector } from '@/components/studio/SubjectPackSelector';
import { SubjectPackManager } from '@/components/studio/SubjectPackManager';
// setBrandDefaultSubjectPack available for async updates if needed
import { useAuth } from '@/hooks/useAuth';
import { BrandSelector } from '@/components/BrandSelector';
import { cn } from '@/lib/utils';
import { useDropzone } from 'react-dropzone';
import { loadGoogleFonts } from '@/hooks/useFontLoader';

// Polices supportées par Cloudinary Google Fonts
const SUPPORTED_FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Nunito Sans', 'Poppins', 
  'Raleway', 'Playfair Display', 'Merriweather', 'Ubuntu', 'Source Sans Pro',
  'Oswald', 'Quicksand', 'Archivo', 'Libre Franklin', 'Work Sans', 'DM Sans',
  'Manrope', 'Outfit', 'Sora', 'Space Grotesk', 'Plus Jakarta Sans',
  'Baloon', 'Pacifico', 'Lobster', 'Dancing Script', 'Comic Neue', 'Fredoka One',
  'Caveat', 'Satisfy', 'Courgette', 'Great Vibes', 'Amatic SC', 'Permanent Marker'
];

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
  { value: 'corporate', label: 'Style corporate' },
  // ✅ NEW: Types adaptatifs pour carrousels
  { value: 'avatars_3d', label: '🧑 Personnages 3D (Pixar)' },
  { value: 'avatars_flat', label: '👤 Personnages illustrés' },
  { value: 'mascotte', label: '🐕 Mascotte de marque' },
  { value: 'product_showcase', label: '📦 Mise en scène produit' },
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [defaultSubjectPackId, setDefaultSubjectPackId] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false); // ✅ V10

  // Charger les Google Fonts pour l'aperçu
  useEffect(() => {
    loadGoogleFonts(SUPPORTED_FONTS);
  }, []);

  const handleLogoDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !brandKit?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Seules les images sont acceptées (PNG, JPG, WEBP)');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Le fichier est trop lourd (max 2 Mo)');
      return;
    }

    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `brand-logos/${brandKit.id}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(path);

      setFormData(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success('Logo uploadé !');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploadingLogo(false);
    }
  }, [brandKit?.id]);

  // ✅ V10: Handle avatar file upload
  const handleAvatarDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !brandKit?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Seules les images sont acceptées (PNG, JPG, WEBP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Le fichier est trop lourd (max 2 Mo)');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `brand-avatars/${brandKit.id}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(path);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success('Avatar uploadé !');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploadingAvatar(false);
    }
  }, [brandKit?.id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleLogoDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
    maxFiles: 1,
    disabled: uploadingLogo
  });

  // ✅ V10: Dropzone for avatar
  const { getRootProps: getAvatarRootProps, getInputProps: getAvatarInputProps, isDragActive: isAvatarDragActive } = useDropzone({
    onDrop: handleAvatarDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
    maxFiles: 1,
    disabled: uploadingAvatar
  });

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logo_url: '' }));
  };

  const handleRemoveAvatar = () => {
    setFormData(prev => ({ ...prev, avatar_url: '' }));
  };
  const [formData, setFormData] = useState({
    name: '',
    logo_url: '',
    avatar_url: '', // ✅ V10: Avatar distinct du logo
    niche: '',
    voice: '',
    font_primary: '',
    font_secondary: '',
    colors: [] as string[],
    text_color: '#FFFFFF', // ✅ V9: Couleur de texte
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
        avatar_url: (brandKit as any).avatar_url || '', // ✅ V10
        niche: brandKit.niche || '',
        voice: brandKit.voice || '',
        font_primary: brandKit.fonts?.primary || '',
        font_secondary: brandKit.fonts?.secondary || '',
        colors,
        text_color: (brandKit as any).text_color || '#FFFFFF', // ✅ V9
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
      
      // Load default subject pack - verify it still exists
      const packId = (brandKit as any).default_subject_pack_id;
      if (packId) {
        supabase
          .from('subject_packs')
          .select('id')
          .eq('id', packId)
          .single()
          .then(({ data }) => {
            setDefaultSubjectPackId(data ? packId : null);
          });
      } else {
        setDefaultSubjectPackId(null);
      }
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
      // Validate that subject pack still exists before saving
      let validSubjectPackId = defaultSubjectPackId;
      if (defaultSubjectPackId) {
        const { data: packExists } = await supabase
          .from('subject_packs')
          .select('id')
          .eq('id', defaultSubjectPackId)
          .single();
        
        if (!packExists) {
          console.warn('[BrandKit] Subject pack not found, resetting to null:', defaultSubjectPackId);
          validSubjectPackId = null;
          setDefaultSubjectPackId(null);
        }
      }

      const { error } = await supabase
        .from('brands')
        .update({
          name: formData.name,
          logo_url: formData.logo_url || null,
          avatar_url: formData.avatar_url || null, // ✅ V10: Avatar distinct
          niche: formData.niche || null,
          voice: formData.voice || null,
          palette: formData.colors,
          fonts: {
            primary: formData.font_primary || null,
            secondary: formData.font_secondary || null
          },
          text_color: formData.text_color || '#FFFFFF', // ✅ V9
          pitch: formData.pitch || null,
          adjectives: formData.adjectives,
          tone_sliders: formData.tone_sliders as { fun: number; accessible: number; energetic: number; direct: number },
          person: formData.person,
          language_level: formData.language_level,
          visual_types: formData.visual_types,
          visual_mood: formData.visual_mood,
          avoid_in_visuals: formData.avoid_in_visuals || null,
          tagline: formData.tagline || null,
          default_subject_pack_id: validSubjectPackId,
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
      
      // Handle foreign key constraint error specifically
      if (error.message?.includes('foreign key constraint') || error.code === '23503') {
        toast.error('Le Subject Pack sélectionné n\'existe plus. Il a été réinitialisé.');
        setDefaultSubjectPackId(null);
      } else {
        toast.error('Alfie n\'a pas pu mettre à jour ta marque. Réessaie dans quelques instants.');
      }
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

          {/* Logo - Upload + URL */}
          <div className="space-y-4">
            <Label>Logo de marque</Label>
            
            {/* Preview */}
            {formData.logo_url && (
              <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
                <img
                  src={formData.logo_url}
                  alt="Logo preview"
                  className="h-24 w-24 object-contain rounded-lg border bg-background"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1">Logo actuel</p>
                  <p className="text-xs text-muted-foreground truncate">{formData.logo_url}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Upload zone */}
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isDragActive && "border-primary bg-primary/5",
                uploadingLogo && "opacity-50 cursor-not-allowed",
                !isDragActive && "border-border hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              {uploadingLogo ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Upload en cours...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragActive ? "Dépose ton logo ici" : "Glisse ton logo ou clique pour parcourir"}
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP • Max 2 Mo</p>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou URL externe</span>
              </div>
            </div>

            {/* URL input */}
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                id="logo_url"
                type="url"
                placeholder="https://example.com/logo.png"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              />
            </div>
          </div>

          {/* ✅ V10: Avatar / Mascotte - DISTINCT du logo */}
          <div className="space-y-4">
            <div>
              <Label>🧑 Avatar / Mascotte</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Personnage ou mascotte utilisé pour les visuels avec protagonistes (distinct du logo commercial)
              </p>
            </div>
            
            {/* Preview */}
            {formData.avatar_url && (
              <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
                <img
                  src={formData.avatar_url}
                  alt="Avatar preview"
                  className="h-24 w-24 object-contain rounded-lg border bg-background"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1">Avatar actuel</p>
                  <p className="text-xs text-muted-foreground truncate">{formData.avatar_url}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveAvatar}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Upload zone */}
            <div
              {...getAvatarRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isAvatarDragActive && "border-primary bg-primary/5",
                uploadingAvatar && "opacity-50 cursor-not-allowed",
                !isAvatarDragActive && "border-border hover:border-primary/50"
              )}
            >
              <input {...getAvatarInputProps()} />
              {uploadingAvatar ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Upload en cours...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isAvatarDragActive ? "Dépose ton avatar ici" : "Glisse ton avatar/mascotte ou clique pour parcourir"}
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP • Max 2 Mo</p>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou URL externe</span>
              </div>
            </div>

            {/* URL input */}
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                id="avatar_url"
                type="url"
                placeholder="https://example.com/avatar.png"
                value={formData.avatar_url}
                onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              />
            </div>
          </div>
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

          {/* Couleur de texte */}
          <div className="space-y-3">
            <Label htmlFor="text_color">Couleur de texte principale</Label>
            <p className="text-xs text-muted-foreground">
              Couleur utilisée pour les textes sur vos carrousels
            </p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="text_color"
                value={formData.text_color.match(/^#[0-9A-Fa-f]{6}$/) ? formData.text_color : '#FFFFFF'}
                onChange={(e) => setFormData({ ...formData, text_color: e.target.value.toUpperCase() })}
                className="h-10 w-16 rounded border cursor-pointer"
              />
              <Input
                value={formData.text_color}
                onChange={(e) => setFormData({ ...formData, text_color: e.target.value.toUpperCase() })}
                placeholder="#FFFFFF"
                className="flex-1 font-mono max-w-32"
              />
            </div>
          </div>

          {/* Polices - Accordéon */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="fonts" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  <span>Polices</span>
                  {(formData.font_primary || formData.font_secondary) && (
                    <Badge 
                      variant="secondary" 
                      className="ml-2 text-xs"
                      style={{ fontFamily: `"${formData.font_primary || formData.font_secondary}", sans-serif` }}
                    >
                      {formData.font_primary || formData.font_secondary}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  ⚠️ Choisis parmi les polices Google Fonts supportées ci-dessous pour garantir un rendu correct sur tes carrousels.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="font_primary">Police principale (titres)</Label>
                    <Input
                      id="font_primary"
                      placeholder="Clique pour voir les options..."
                      value={formData.font_primary}
                      onChange={(e) => setFormData({ ...formData, font_primary: e.target.value })}
                      list="fonts-primary-list"
                    />
                    <datalist id="fonts-primary-list">
                      {SUPPORTED_FONTS.map(font => (
                        <option key={font} value={font} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="font_secondary">Police secondaire (corps)</Label>
                    <Input
                      id="font_secondary"
                      placeholder="Clique pour voir les options..."
                      value={formData.font_secondary}
                      onChange={(e) => setFormData({ ...formData, font_secondary: e.target.value })}
                      list="fonts-secondary-list"
                    />
                    <datalist id="fonts-secondary-list">
                      {SUPPORTED_FONTS.map(font => (
                        <option key={font} value={font} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Quick select buttons */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Sélection rapide :</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Montserrat', 'Poppins', 'Playfair Display', 'Inter', 'Raleway', 'Oswald', 'Quicksand', 'DM Sans'].map(font => (
                      <Badge
                        key={font}
                        variant={formData.font_primary === font ? "default" : "outline"}
                        className="cursor-pointer text-xs hover:bg-primary/10 transition-colors"
                        style={{ fontFamily: `"${font}", sans-serif` }}
                        onClick={() => setFormData({ ...formData, font_primary: font })}
                      >
                        {font}
                      </Badge>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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

      {/* Card 4: Subject Pack par défaut */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Subject Packs</CardTitle>
          </div>
          <CardDescription>
            Personnages ou éléments récurrents utilisés dans tes contenus
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Subject Pack par défaut */}
          <div className="space-y-2">
            <Label>Subject Pack par défaut</Label>
            <SubjectPackSelector
              value={defaultSubjectPackId}
              onChange={setDefaultSubjectPackId}
              brandId={brandKit?.id}
              placeholder="Aucun subject par défaut"
            />
            <p className="text-xs text-muted-foreground">
              Ce subject sera automatiquement appliqué aux contenus créés avec cette marque
            </p>
          </div>

          {/* Subject Pack Manager intégré */}
          <div className="pt-4 border-t">
            <SubjectPackManager 
              showHeader={true}
              brandId={brandKit?.id}
              onPackSelect={(packId) => setDefaultSubjectPackId(packId)}
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
