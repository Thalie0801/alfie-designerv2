import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Sparkles } from 'lucide-react';
import { CharacterCounter } from './CharacterCounter';

export interface BriefFormData {
  objective: string;
  audience: string;
  offer: string;
  proofs: string[];
  cta: string;
  tone: string;
  locale: string;
}

interface BriefFormProps {
  onSubmit: (brief: BriefFormData) => void;
  onCancel: () => void;
}

const TONES = [
  { value: 'professional', label: 'Sobre B2B' },
  { value: 'energetic', label: 'Énergique' },
  { value: 'educational', label: 'Pédagogique' },
  { value: 'friendly', label: 'Convivial' },
  { value: 'luxury', label: 'Premium/Luxe' },
  { value: 'technical', label: 'Technique' },
  { value: 'custom', label: 'Personnalisé' }
];

const LOCALES = [
  { value: 'fr-FR', label: '🇫🇷 Français' },
  { value: 'en-US', label: '🇺🇸 English' },
  { value: 'es-ES', label: '🇪🇸 Español' },
  { value: 'de-DE', label: '🇩🇪 Deutsch' },
  { value: 'it-IT', label: '🇮🇹 Italiano' },
  { value: 'pt-BR', label: '🇧🇷 Português' }
];

export function BriefForm({ onSubmit, onCancel }: BriefFormProps) {
  const [formData, setFormData] = useState<BriefFormData>({
    objective: '',
    audience: '',
    offer: '',
    proofs: [],
    cta: '',
    tone: 'professional',
    locale: 'fr-FR'
  });
  const [newProof, setNewProof] = useState('');
  const [customTone, setCustomTone] = useState('');

  const isValid = () => {
    return formData.objective.trim() &&
           formData.audience.trim() &&
           formData.offer.trim() &&
           formData.cta.trim() &&
           formData.objective.length <= 100 &&
           formData.audience.length <= 100 &&
           formData.offer.length <= 200 &&
           formData.cta.length <= 40;
  };

  const addProof = () => {
    if (!newProof.trim()) return;
    if (formData.proofs.length >= 3) return;
    
    setFormData({
      ...formData,
      proofs: [...formData.proofs, newProof.trim()]
    });
    setNewProof('');
  };

  const removeProof = (index: number) => {
    setFormData({
      ...formData,
      proofs: formData.proofs.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid()) return;

    const finalData = {
      ...formData,
      tone: formData.tone === 'custom' ? customTone : formData.tone
    };
    
    onSubmit(finalData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Brief Carrousel</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" disabled={!isValid()} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Générer le plan
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Informations essentielles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Objectif *</Label>
              <CharacterCounter current={formData.objective.length} max={100} />
            </div>
            <Input
              value={formData.objective}
              onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
              placeholder='Ex: "lancement", "promo -25%", "démo produit"'
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Audience *</Label>
              <CharacterCounter current={formData.audience.length} max={100} />
            </div>
            <Input
              value={formData.audience}
              onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
              placeholder='Ex: "PME B2B", "coachs bien-être", "développeurs"'
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Offre/Produit *</Label>
              <CharacterCounter current={formData.offer.length} max={200} />
            </div>
            <Textarea
              value={formData.offer}
              onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
              placeholder="Décrivez votre offre en 1 phrase claire..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Preuves (1-3)</Label>
            {formData.proofs.length > 0 && (
              <div className="space-y-2">
                {formData.proofs.map((proof, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{idx + 1}.</span>
                    <Input value={proof} readOnly className="flex-1" />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeProof(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {formData.proofs.length < 3 && (
              <div className="flex gap-2">
                <Input
                  value={newProof}
                  onChange={(e) => setNewProof(e.target.value)}
                  placeholder='Ex: "avis 5★", "1000+ clients", "Logo X autorisé"'
                  maxLength={150}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addProof();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={addProof}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Call-to-Action *</Label>
              <CharacterCounter current={formData.cta.length} max={40} />
            </div>
            <Input
              value={formData.cta}
              onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
              placeholder='Ex: "Essayer", "Demander une démo"'
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ton & Langue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Ton/Style *</Label>
            <Select
              value={formData.tone}
              onValueChange={(value) => setFormData({ ...formData, tone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map(tone => (
                  <SelectItem key={tone.value} value={tone.value}>
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.tone === 'custom' && (
            <div className="space-y-2">
              <Label>Décrivez votre ton</Label>
              <Input
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
                placeholder="Ex: Dynamique mais sérieux, avec une touche d'humour..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Langue *</Label>
            <Select
              value={formData.locale}
              onValueChange={(value) => setFormData({ ...formData, locale: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map(locale => (
                  <SelectItem key={locale.value} value={locale.value}>
                    {locale.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
