import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type AspectRatio = '4:5' | '1:1' | '9:16' | '16:9';

export interface CarouselGlobals {
  aspect_ratio: AspectRatio;
  totalSlides: number;
  locale: string;
}

interface PlanGlobalsEditorProps {
  globals: CarouselGlobals;
  onUpdate: (updated: CarouselGlobals) => void;
  className?: string;
  minSlides?: number; // défaut 3
  maxSlides?: number; // défaut 10
}

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '4:5', label: '4:5 (Portrait feed)' },
  { value: '1:1', label: '1:1 (Carré)' },
  { value: '9:16', label: '9:16 (Story/Reel)' },
  { value: '16:9', label: '16:9 (Paysage)' },
];

const LOCALES = [
  { value: 'fr-FR', label: '🇫🇷 Français' },
  { value: 'en-US', label: '🇺🇸 English' },
  { value: 'es-ES', label: '🇪🇸 Español' },
  { value: 'de-DE', label: '🇩🇪 Deutsch' },
  { value: 'it-IT', label: '🇮🇹 Italiano' },
  { value: 'pt-BR', label: '🇧🇷 Português' },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function PlanGlobalsEditor({
  globals,
  onUpdate,
  className,
  minSlides = 3,
  maxSlides = 10,
}: PlanGlobalsEditorProps) {
  const safeEmit = (partial: Partial<CarouselGlobals>) => {
    const next = { ...globals, ...partial };
    // n'émet que si ça change réellement
    if (
      next.aspect_ratio !== globals.aspect_ratio ||
      next.totalSlides !== globals.totalSlides ||
      next.locale !== globals.locale
    ) {
      onUpdate(next);
    }
  };

  const handleSlidesChange = (raw: string, commitOnBlur = false) => {
    // autorise champ vide pendant la saisie
    if (!commitOnBlur && raw === '') {
      // n'émet pas encore pour éviter NaN
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    const value = Number.isFinite(parsed) ? clamp(parsed, minSlides, maxSlides) : globals.totalSlides;
    safeEmit({ totalSlides: value });
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-sm">Paramètres généraux</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="aspect">Format</Label>
            <Select
              value={globals.aspect_ratio}
              onValueChange={(value) =>
                safeEmit({ aspect_ratio: value as AspectRatio })
              }
            >
              <SelectTrigger id="aspect" aria-label="Choisir le format">
                <SelectValue placeholder="Choisir un format" />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((ratio) => (
                  <SelectItem key={ratio.value} value={ratio.value}>
                    {ratio.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slides">Nombre de slides</Label>
            <Input
              id="slides"
              type="number"
              inputMode="numeric"
              min={minSlides}
              max={maxSlides}
              value={globals.totalSlides}
              onChange={(e) => handleSlidesChange(e.target.value)}
              onBlur={(e) => handleSlidesChange(e.target.value, true)}
              aria-describedby="slides-help"
            />
            <p id="slides-help" className="text-[11px] text-muted-foreground">
              {minSlides}–{maxSlides} slides
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locale">Langue</Label>
            <Select
              value={globals.locale}
              onValueChange={(value) => safeEmit({ locale: value })}
            >
              <SelectTrigger id="locale" aria-label="Choisir la langue">
                <SelectValue placeholder="Choisir la langue" />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((locale) => (
                  <SelectItem key={locale.value} value={locale.value}>
