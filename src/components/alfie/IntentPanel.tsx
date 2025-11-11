import * as React from 'react';
import type { AlfieIntent, Ratio } from '@/lib/types/alfie';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

type Props = {
  value: Pick<
    AlfieIntent,
    'kind' | 'brandId' | 'ratio' | 'slides' | 'paletteLock' | 'typographyLock' | 'cta' | 'language'
  >;
  onChange: (next: Partial<AlfieIntent>) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

const RATIOS: Ratio[] = ['1:1', '9:16', '16:9', '3:4'];

export function IntentPanel({ value, onChange, onSubmit, disabled, loading }: Props) {
  const isCarousel = value.kind === 'carousel';
  const isDisabled = disabled || loading;
  const canSubmit = Boolean(value.brandId);
  const submitDisabled = isDisabled || !canSubmit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label>Ratio</Label>
          <Select
            value={value.ratio ?? undefined}
            onValueChange={(v) => onChange({ ratio: v as Ratio })}
            disabled={isDisabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir un ratio" />
            </SelectTrigger>
            <SelectContent>
              {RATIOS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCarousel ? (
          <div className="grid gap-2">
            <Label>Slides</Label>
            <Input
              type="number"
              min={3}
              step={1}
              value={value.slides ?? 5}
              onChange={(event) =>
                onChange({ slides: Math.max(1, Number(event.target.value || 0)) })
              }
              disabled={isDisabled}
            />
            <p className="text-xs text-muted-foreground">Minimum conseillé : 3</p>
          </div>
        ) : null}

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <Label>Verrou palette</Label>
              <p className="text-xs text-muted-foreground">
                Force l’utilisation stricte de la palette de marque.
              </p>
            </div>
            <Switch
              checked={!!value.paletteLock}
              onCheckedChange={(v) => onChange({ paletteLock: v })}
              disabled={isDisabled}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <Label>Verrou typographie</Label>
              <p className="text-xs text-muted-foreground">
                Force la/les police(s) de la charte.
              </p>
            </div>
            <Switch
              checked={!!value.typographyLock}
              onCheckedChange={(v) => onChange({ typographyLock: v })}
              disabled={isDisabled}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>CTA (optionnel)</Label>
          <Input
            placeholder="Ex: Découvrir l’offre"
            value={value.cta ?? ''}
            onChange={(event) => onChange({ cta: event.target.value || undefined })}
            disabled={isDisabled}
          />
        </div>

        {onSubmit ? (
          <div className="pt-2">
            <Button
              type="button"
              onClick={onSubmit}
              disabled={submitDisabled}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération…
                </span>
              ) : (
                'Générer'
              )}
            </Button>
            {!canSubmit ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Sélectionne une marque avant de lancer la génération.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default IntentPanel;
