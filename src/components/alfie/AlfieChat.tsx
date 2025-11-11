import * as React from 'react';
import type { AlfieIntent, JobKind, Kind, Language } from '@/lib/types/alfie';
import IntentPanel from './IntentPanel';
import JobConsole from './JobConsole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

const KINDS: Kind[] = ['carousel', 'image', 'video', 'text'];
const LANGS: Language[] = ['fr', 'en', 'es'];

type Brand = {
  id: string;
  name: string;
};

type GenerateOrderResult = {
  orderId: string;
  plan?: JobKind[];
  warnings?: string[];
};

type Props = {
  onGenerateOrder: (intent: AlfieIntent) => Promise<GenerateOrderResult>;
  brands: Brand[];
  defaultKind?: Kind;
};

export function AlfieChat({ onGenerateOrder, brands, defaultKind = 'carousel' }: Props) {
  const [intent, setIntent] = React.useState<AlfieIntent>(() => ({
    kind: defaultKind,
    brandId: brands[0]?.id ?? '',
    language: 'fr',
    ratio: defaultKind === 'carousel' ? '9:16' : '1:1',
    slides: defaultKind === 'carousel' ? 5 : undefined,
    paletteLock: false,
    typographyLock: false,
  } as AlfieIntent));
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastPlanKinds, setLastPlanKinds] = React.useState<JobKind[] | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!brands.length) {
      setIntent((prev) => ({ ...prev, brandId: '' } as AlfieIntent));
      return;
    }
    setIntent((prev) => {
      if (prev.brandId) return prev;
      return { ...prev, brandId: brands[0].id } as AlfieIntent;
    });
  }, [brands]);

  const updateIntent = React.useCallback((patch: Partial<AlfieIntent>) => {
    setIntent((prev) => ({ ...prev, ...patch } as AlfieIntent));
  }, []);

  const handleKindChange = React.useCallback((nextKind: Kind) => {
    setIntent((prev) => {
      const next: AlfieIntent = { ...prev, kind: nextKind };
      if (nextKind === 'carousel') {
        next.slides = prev.slides ?? 5;
        next.ratio = prev.ratio ?? '9:16';
      } else if (nextKind === 'image') {
        next.slides = 1;
        next.ratio = prev.ratio ?? '1:1';
      } else if (nextKind === 'video') {
        next.slides = undefined;
        next.ratio = prev.ratio ?? '16:9';
      } else {
        next.slides = undefined;
      }
      return next;
    });
  }, []);

  const handleLanguageChange = React.useCallback((next: Language) => {
    updateIntent({ language: next });
  }, [updateIntent]);

  const handleBrandChange = React.useCallback((nextBrandId: string) => {
    updateIntent({ brandId: nextBrandId });
  }, [updateIntent]);

  const handleSubmit = React.useCallback(async () => {
    if (!intent.brandId) {
      setError('Sélectionne une marque avant de lancer la génération.');
      return;
    }
    setBusy(true);
    setError(null);
    setOrderId(null);
    setLastPlanKinds(null);
    setWarnings([]);
    try {
      const response = await onGenerateOrder(intent);
      setOrderId(response.orderId);
      setLastPlanKinds(response.plan ?? null);
      setWarnings(response.warnings ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [intent, onGenerateOrder]);

  const lastPlanSummary = React.useMemo(() => {
    if (!lastPlanKinds || lastPlanKinds.length === 0) return null;
    return lastPlanKinds.join(' → ');
  }, [lastPlanKinds]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-6">
        {brands.length === 0 ? (
          <Alert className="border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/30 dark:bg-sky-950/30 dark:text-sky-100">
            <AlertTitle>Aucune marque disponible</AlertTitle>
            <AlertDescription>
              Ajoute une marque dans ton workspace pour pouvoir planifier une génération Alfie.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Marque</Label>
              <Select
                value={intent.brandId}
                onValueChange={handleBrandChange}
                disabled={!brands.length || busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionne une marque" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Format</Label>
              <Select value={intent.kind} onValueChange={(value) => handleKindChange(value as Kind)} disabled={busy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind} className="capitalize">
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Langue</Label>
              <Select value={intent.language} onValueChange={(value) => handleLanguageChange(value as Language)} disabled={busy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((lang) => (
                    <SelectItem key={lang} value={lang} className="uppercase">
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <IntentPanel
          value={intent}
          onChange={updateIntent}
          onSubmit={handleSubmit}
          disabled={busy}
          loading={busy}
        />

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {warnings.length > 0 ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTitle>Avertissements</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-5">
                {warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`} className="text-sm">
                    {warning}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        {orderId ? (
          <Card>
            <CardHeader>
              <CardTitle>Dernière génération</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">Order #{orderId}</p>
              {lastPlanSummary ? (
                <Badge variant="outline" className="capitalize">
                  {lastPlanSummary}
                </Badge>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <JobConsole orderId={orderId} />
    </div>
  );
}

export default AlfieChat;
