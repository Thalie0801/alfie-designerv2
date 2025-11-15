import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Download,
  LibraryBig,
  Loader2,
  Paperclip,
  RefreshCcw,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { uploadToChatBucket } from '@/lib/chatUploads';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { AspectRatio } from './studioApi';
import { generateCarousel, generateImage, generateVideo } from './studioApi';
import { parseBatchRequest } from './batchUtils';
import {
  useMediaGenerationsWatcher,
  type MediaGenerationRow,
} from './useMediaGenerationsWatcher';
import { GeneratedAsset, InputMedia, StudioMessage, StudioV2PersistedState } from './types';

interface StudioV2Props {
  activeBrandId: string | null;
}

const STORAGE_KEY = 'alfie_studio_v2_state';
const RESET_DELAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ASPECT_RATIO: AspectRatio = '1:1';
const DEFAULT_CAROUSEL_SLIDES = 5;
const DEFAULT_VIDEO_DURATION = 15;

const statusLabels: Record<GeneratedAsset['status'], string> = {
  pending: 'En attente',
  processing: 'En cours',
  completed: 'Terminé',
  failed: 'Échec',
};

const statusColors: Record<GeneratedAsset['status'], string> = {
  pending: 'bg-muted text-muted-foreground',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
};

const mediaAccept: Record<'image' | 'video', string[]> = {
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'],
  video: ['video/mp4', 'video/quicktime'],
};

const mediaTypeFromMime = (type: string): 'image' | 'video' | null => {
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  return null;
};

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

export function StudioV2({ activeBrandId }: StudioV2Props) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [messages, setMessages] = useState<StudioMessage[]>([]);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputMedias, setInputMedias] = useState<InputMedia[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  const lastActivityRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const touchActivity = useCallback(() => {
    lastActivityRef.current = new Date().toISOString();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      lastActivityRef.current = new Date().toISOString();
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StudioV2PersistedState;
      if (!parsed?.lastActivityAt) throw new Error('invalid');
      const last = new Date(parsed.lastActivityAt).getTime();
      if (Number.isNaN(last) || Date.now() - last > RESET_DELAY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        lastActivityRef.current = new Date().toISOString();
        setHydrated(true);
        return;
      }

      setMessages(parsed.messages ?? []);
      setAssets(parsed.assets ?? []);
      setInputMedias(parsed.inputMedias ?? []);
      lastActivityRef.current = parsed.lastActivityAt;
    } catch (error) {
      console.warn('[StudioV2] unable to parse stored state', error);
      localStorage.removeItem(STORAGE_KEY);
      lastActivityRef.current = new Date().toISOString();
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    const payload: StudioV2PersistedState = {
      messages,
      assets,
      inputMedias,
      lastActivityAt: lastActivityRef.current ?? new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [messages, assets, inputMedias, hydrated]);

  const updateAsset = useCallback((assetId: string, patch: Partial<GeneratedAsset>) => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId || asset.resourceId === assetId
          ? { ...asset, ...patch }
          : asset,
      ),
    );
    setMessages((prev) =>
      prev.map((message) =>
        message.assets
          ? {
              ...message,
              assets: message.assets.map((asset) =>
                asset.id === assetId || asset.resourceId === assetId
                  ? { ...asset, ...patch }
                  : asset,
              ),
            }
          : message,
      ),
    );
  }, []);

  const resourceIds = useMemo(() => {
    const ids = assets
      .filter((asset) => asset.resourceId)
      .map((asset) => asset.resourceId as string);
    return Array.from(new Set(ids));
  }, [assets]);

  const handleGenerationUpdate = useCallback(
    (row: MediaGenerationRow) => {
      const statusMap: Record<string, GeneratedAsset['status']> = {
        queued: 'processing',
        running: 'processing',
        processing: 'processing',
        completed: 'completed',
        failed: 'failed',
      };
      const mappedStatus = statusMap[row.status] ?? 'processing';
      const preview = row.thumbnail_url ?? row.render_url ?? row.output_url ?? undefined;
      const download = row.output_url ?? row.render_url ?? undefined;
      const typeFromRow =
        row.type === 'image' || row.type === 'carousel' || row.type === 'video'
          ? row.type
          : undefined;
      updateAsset(row.id, {
        status: mappedStatus,
        previewUrl: preview,
        downloadUrl: download,
        meta: row.metadata ?? undefined,
        resourceId: row.id,
        ...(typeFromRow ? { type: typeFromRow } : {}),
      });
    },
    [updateAsset],
  );

  useMediaGenerationsWatcher(resourceIds, handleGenerationUpdate);

  const handleDownload = useCallback((asset: GeneratedAsset) => {
    if (!asset.downloadUrl) return;
    const link = document.createElement('a');
    link.href = asset.downloadUrl;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleDownloadSelected = useCallback(() => {
    const selected = assets.filter((asset) => selectedAssetIds.has(asset.id));
    if (selected.length === 0) {
      toast({ title: 'Aucun asset sélectionné', description: 'Sélectionne au moins un asset à télécharger.' });
      return;
    }

    for (const asset of selected) {
      if (asset.downloadUrl) {
        handleDownload(asset);
      }
    }
  }, [assets, selectedAssetIds, handleDownload, toast]);

  const handleToggleSelection = useCallback((assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setMessages([]);
    setAssets([]);
    setInputMedias([]);
    setSelectedAssetIds(new Set());
    lastActivityRef.current = new Date().toISOString();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const handleAddToLibrary = useCallback(
    async (assetId: string) => {
      const asset = assets.find((item) => item.id === assetId);
      if (!asset) return;
      if (!asset.downloadUrl) {
        toast({
          title: "Téléchargement indisponible",
          description: "L'asset doit être terminé avant de rejoindre la bibliothèque.",
          variant: 'destructive',
        });
        return;
      }
      if (!user?.id) {
        toast({
          title: 'Connexion requise',
          description: 'Reconnecte-toi pour enregistrer dans la bibliothèque.',
          variant: 'destructive',
        });
        return;
      }

      try {
        const payload: Record<string, any> = {
          cloudinary_url: asset.downloadUrl,
          type: asset.type,
          user_id: user.id,
          brand_id: activeBrandId ?? undefined,
          metadata: asset.meta ?? {},
        };
        if (asset.meta?.orderId) payload.order_id = asset.meta.orderId;
        if (asset.meta?.order_item_id) payload.order_item_id = asset.meta.order_item_id;

        const { error } = await supabase.from('library_assets').insert(payload);
        if (error) throw error;

        updateAsset(assetId, { inLibrary: true });
        toast({ title: 'Ajouté à la bibliothèque', description: 'Retrouve cet asset dans ta bibliothèque Alfie.' });
      } catch (error) {
        console.error('[StudioV2] unable to add to library', error);
        toast({
          title: "Échec de l'ajout",
          description: "Impossible d'ajouter l'asset à la bibliothèque.",
          variant: 'destructive',
        });
      }
    },
    [assets, user?.id, activeBrandId, toast, updateAsset],
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files?.length) return;
      if (!user?.id) {
        toast({
          title: 'Connexion requise',
          description: 'Identifie-toi pour ajouter un média de référence.',
          variant: 'destructive',
        });
        return;
      }
      setIsUploading(true);
      try {
        const newMedias: InputMedia[] = [];
        for (const file of Array.from(files)) {
          const mediaType = mediaTypeFromMime(file.type);
          if (!mediaType) {
            toast({
              title: 'Format non supporté',
              description: `${file.name} n'est pas un format image/vidéo supporté.`,
              variant: 'destructive',
            });
            continue;
          }

          const { signedUrl } = await uploadToChatBucket(file, supabase, user.id);
          newMedias.push({
            id: makeId(),
            type: mediaType,
            url: signedUrl,
            name: file.name,
            size: file.size,
          });
        }
        if (newMedias.length) {
          setInputMedias((prev) => [...prev, ...newMedias]);
          touchActivity();
        }
      } catch (error) {
        console.error('[StudioV2] upload failed', error);
        toast({
          title: "Échec de l'upload",
          description: 'Impossible de téléverser ce média. Réessaie plus tard.',
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [user?.id, toast, touchActivity],
  );

  const removeInputMedia = useCallback((id: string) => {
    setInputMedias((prev) => prev.filter((media) => media.id !== id));
    touchActivity();
  }, [touchActivity]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const prompt = inputValue.trim();
      if (!prompt) return;
      if (!activeBrandId) {
        toast({
          title: 'Sélectionne une marque',
          description: 'Choisis un brand kit pour générer des assets.',
          variant: 'destructive',
        });
        return;
      }

      const userMessage: StudioMessage = {
        id: makeId(),
        role: 'user',
        content: prompt,
        createdAt: new Date().toISOString(),
      };

      const batchItems = parseBatchRequest(prompt);
      const summaryParts = batchItems.map((item) => `${item.count} ${item.type === 'image' ? 'image(s)' : item.type === 'carousel' ? 'carrousel(s)' : 'vidéo(s)'}`);
      const assistantMessage: StudioMessage = {
        id: makeId(),
        role: 'assistant',
        content: `Je lance la génération de ${summaryParts.join(', ')} pour « ${prompt} ».`,
        createdAt: new Date().toISOString(),
      };

      const placeholders: GeneratedAsset[] = [];
      batchItems.forEach((item) => {
        for (let i = 0; i < item.count; i += 1) {
          placeholders.push({ id: makeId(), type: item.type, status: 'pending' });
        }
      });
      assistantMessage.assets = placeholders;

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setAssets((prev) => [...prev, ...placeholders]);
      setInputValue('');
      setSelectedAssetIds(new Set());
      touchActivity();

      const mediaPayload = inputMedias.map((media) => ({ type: media.type, url: media.url }));
      setInputMedias([]);

      setIsSubmitting(true);
      await Promise.all(
        placeholders.map(async (asset) => {
          updateAsset(asset.id, { status: 'processing' });
          try {
            let resourceId: string;
            if (asset.type === 'image') {
              resourceId = await generateImage({
                prompt,
                brandId: activeBrandId,
                aspectRatio: DEFAULT_ASPECT_RATIO,
                inputMedia: mediaPayload,
              });
            } else if (asset.type === 'carousel') {
              resourceId = await generateCarousel({
                prompt,
                brandId: activeBrandId,
                aspectRatio: DEFAULT_ASPECT_RATIO,
                slides: DEFAULT_CAROUSEL_SLIDES,
                inputMedia: mediaPayload,
              });
            } else {
              resourceId = await generateVideo({
                prompt,
                brandId: activeBrandId,
                aspectRatio: '9:16',
                durationSeconds: DEFAULT_VIDEO_DURATION,
                inputMedia: mediaPayload,
              });
            }
            updateAsset(asset.id, { resourceId, status: 'processing' });
          } catch (error) {
            console.error('[StudioV2] generation failed', error);
            updateAsset(asset.id, { status: 'failed' });
            toast({
              title: 'Génération impossible',
              description: "Nous n'avons pas pu générer cet asset.",
              variant: 'destructive',
            });
          }
        }),
      );
      setIsSubmitting(false);
      touchActivity();
    },
    [inputValue, activeBrandId, toast, inputMedias, touchActivity, updateAsset],
  );

  const formattedMessages = useMemo(() => {
    return messages.map((message) => ({
      ...message,
      formattedDate: format(new Date(message.createdAt), "dd MMM yyyy HH:mm", { locale: fr }),
    }));
  }, [messages]);

  const hasAssets = assets.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6">
      <section className="border rounded-lg bg-card text-card-foreground flex flex-col h-[720px]">
        <header className="p-4 border-b">
          <h2 className="text-lg font-semibold">Chat Studio</h2>
          <p className="text-sm text-muted-foreground">
            Discute avec Alfie, ajoute des médias de référence et lance des batchs de génération.
          </p>
        </header>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {formattedMessages.length === 0 && (
              <div className="text-sm text-muted-foreground">
                Commence une conversation, par exemple « 3 carrousels + 2 images sur notre nouveau produit ».
              </div>
            )}
            {formattedMessages.map((message) => (
              <div key={message.id} className={cn('flex flex-col gap-1', message.role === 'user' ? 'items-end text-right' : 'items-start text-left')}>
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 max-w-[85%] text-sm shadow-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <div className="whitespace-pre-wrap text-left text-sm text-foreground">
                    {message.content}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                    <span>{message.formattedDate}</span>
                    {message.assets?.length ? (
                      <Badge variant="secondary">{message.assets.length} asset(s)</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <footer className="border-t p-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">Médias de référence</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {inputMedias.map((media) => (
                <div
                  key={media.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs bg-muted"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <div className="flex flex-col">
                    <span className="font-medium">{media.name ?? media.type.toUpperCase()}</span>
                    {typeof media.size === 'number' ? (
                      <span className="text-muted-foreground">
                        {(media.size / 1024 / 1024).toFixed(1)} Mo
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInputMedia(media.id)}
                    className="ml-2 text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Upload...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Ajouter un média
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={[...mediaAccept.image, ...mediaAccept.video].join(',')}
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              placeholder="Décris ta demande..."
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                <RefreshCcw className="mr-2 h-4 w-4" /> Vider le Studio
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Génération...
                  </>
                ) : (
                  <>
                    Envoyer <Send className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </footer>
      </section>

      <section className="border rounded-lg bg-card text-card-foreground flex flex-col">
        <header className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Résultats</h2>
            <p className="text-sm text-muted-foreground">
              Prévisualise, télécharge et envoie dans ta bibliothèque Alfie.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadSelected} disabled={!selectedAssetIds.size}>
              <Download className="mr-2 h-4 w-4" /> Télécharger la sélection
            </Button>
            <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/library')}>
              <LibraryBig className="mr-2 h-4 w-4" /> Voir la bibliothèque
            </Button>
          </div>
        </header>
        <ScrollArea className="flex-1 p-4">
          {!hasAssets ? (
            <div className="text-sm text-muted-foreground">
              Aucun asset généré pour l'instant. Lance une requête via le chat.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset) => (
                <article key={asset.id} className="border rounded-lg overflow-hidden bg-background flex flex-col">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedAssetIds.has(asset.id)}
                        onCheckedChange={() => handleToggleSelection(asset.id)}
                        id={`select-${asset.id}`}
                      />
                      <label htmlFor={`select-${asset.id}`} className="text-sm font-medium capitalize">
                        {asset.type}
                      </label>
                    </div>
                    <Badge className={cn('capitalize', statusColors[asset.status])}>{statusLabels[asset.status]}</Badge>
                  </div>
                  <div className="p-3 space-y-3 flex-1 flex flex-col">
                    <div className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
                      {asset.previewUrl ? (
                        asset.type === 'video' ? (
                          <video src={asset.previewUrl} controls className="w-full h-full object-cover" />
                        ) : (
                          <img src={asset.previewUrl} alt={asset.type} className="w-full h-full object-cover" />
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {asset.status === 'failed' ? "Erreur de génération" : 'En attente de rendu...'}
                        </span>
                      )}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownload(asset)}
                        disabled={!asset.downloadUrl}
                      >
                        <Download className="mr-2 h-4 w-4" /> Télécharger
                      </Button>
                      <Button
                        type="button"
                        variant={asset.inLibrary ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleAddToLibrary(asset.id)}
                        disabled={asset.inLibrary}
                      >
                        {asset.inLibrary ? (
                          'Dans la bibliothèque'
                        ) : (
                          <>
                            <LibraryBig className="mr-2 h-4 w-4" /> Ajouter à la bibliothèque
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </ScrollArea>
      </section>
    </div>
  );
}
