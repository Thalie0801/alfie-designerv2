import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface CarouselGlobals {
  aspect_ratio: '4:5' | '1:1' | '9:16';
  totalSlides: number;
  locale: string;
}

interface PlanGlobalsEditorProps {
  globals: CarouselGlobals;
  onUpdate: (updated: CarouselGlobals) => void;
}

const ASPECT_RATIOS = [
  { value: '4:5', label: '4:5 (Instagram Portrait)' },
  { value: '1:1', label: '1:1 (Carré)' },
  { value: '9:16', label: '9:16 (Story)' }
];

const LOCALES = [
  { value: 'fr-FR', label: '🇫🇷 Français' },
  { value: 'en-US', label: '🇺🇸 English' },
  { value: 'es-ES', label: '🇪🇸 Español' },
  { value: 'de-DE', label: '🇩🇪 Deutsch' },
  { value: 'it-IT', label: '🇮🇹 Italiano' },
  { value: 'pt-BR', label: '🇧🇷 Português' }
];

export function PlanGlobalsEditor({ globals, onUpdate }: PlanGlobalsEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Paramètres généraux</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <Select
              value={globals.aspect_ratio}
              onValueChange={(value) => onUpdate({ ...globals, aspect_ratio: value as CarouselGlobals['aspect_ratio'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map(ratio => (
                  <SelectItem key={ratio.value} value={ratio.value}>
                    {ratio.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nombre de slides</Label>
            <Input
              type="number"
              min={3}
              max={10}
              value={globals.totalSlides}
              onChange={(e) => onUpdate({ ...globals, totalSlides: parseInt(e.target.value) || 5 })}
            />
          </div>

          <div className="space-y-2">
            <Label>Langue</Label>
            <Select
              value={globals.locale}
              onValueChange={(value) => onUpdate({ ...globals, locale: value })}
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
        </div>
      </CardContent>
    </Card>
  );
}
