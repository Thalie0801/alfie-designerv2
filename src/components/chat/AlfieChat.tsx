import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, ImagePlus, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBrandKit } from '@/hooks/useBrandKit';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useCarouselSubscription } from '@/hooks/useCarouselSubscription';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image' | 'video' | 'carousel';
  assetUrl?: string;
  assetId?: string;
  metadata?: Record<string, unknown>;
};

type Intent = 'image' | 'video' | 'carousel';

type AlfieChatProps = {
  variant?: 'page' | 'widget';
  onClose?: () => void;
};

type VideoStatus = {
  status: 'processing' | 'completed' | 'failed';
  jobId: string;
  outputUrl?: string;
  thumbnailUrl?: string | null;
  errorMessage?: string;
};

type CarouselMetadata = {
  jobSetId: string;
  total: number;
  items: Array<{ id: string; url: string; index: number }>;
};

const QUICK_PROMPTS = [
  'Image 1:1 — Golden retriever façon Pixar',
  'Vidéo 9:16 de 10s — marketing digital',
  'Carrousel 5 slides — SEO pour PME'
];

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  type: 'text',
  content:
    "👋 Salut ! Je suis Alfie. Je peux générer des **images**, des **vidéos** ou des **carrousels** pour ta marque. Décris-moi ce que tu veux créer."
};

function detectIntent(prompt: string): Intent {
  const lower = prompt.toLowerCase();

  if (/(carrousel|carousel|slides|diapos?)/.test(lower)) {
    return 'carousel';
  }

  if (/(vidéo|video|reel|short|story|tiktok|youtube|clip)/.test(lower)) {
    return 'video';
  }

  return 'image';
}

function detectAspectRatio(prompt: string): string {
  const ratioMatch = prompt.match(/(1:1|4:5|9:16|16:9)/);
  if (ratioMatch) {
    return ratioMatch[1];
  }
  if (/portrait|story|tiktok|reel|short|9\s*:\s*16/i.test(prompt)) {
    return '9:16';
  }
  if (/youtube|paysage|wide|16\s*:\s*9/i.test(prompt)) {
    return '16:9';
  }
  return '1:1';
}

function detectCarouselCount(prompt: string): number {
  const match = prompt.match(/(\d+)\s*(slides?|pages?|diapos?)/i);
  if (match) {
    const value = parseInt(match[1], 10);
    if (!Number.isNaN(value) && value > 0) {
      return Math.min(10, value);
    }
  }
  return 5;
}

function detectVideoCost(prompt: string): number {
  const durationMatch = prompt.match(/(\d{1,2})\s*(s|sec|secondes?)/i);
  if (durationMatch) {
    const duration = parseInt(durationMatch[1], 10);
    if (!Number.isNaN(duration)) {
      if (duration >= 20) return 3;
      if (duration >= 10) return 2;
      return 1;
    }
  }
  if (/longue|long|campagne|story/.test(prompt.toLowerCase())) {
    return 2;
  }
  return 2;
}

function buildId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AlfieChat({ variant = 'page', onClose }: AlfieChatProps) {
  const { activeBrandId } = useBrandKit();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const [activeJobSetId, setActiveJobSetId] = useState<string>('');
  const [carouselTotal, setCarouselTotal] = useState<number>(0);
  const [carouselDone, setCarouselDone] = useState<number>(0);
  const [activeCarouselMessageId, setActiveCarouselMessageId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoPollers = useRef<Map<string, number>>(new Map());

  const carouselSubscription = useCarouselSubscription(activeJobSetId, carouselTotal);

  useEffect(() => {
    setCarouselDone(carouselSubscription.done);

    if (!activeCarouselMessageId) return;

    updateMessage(activeCarouselMessageId, {
      metadata: {
        jobSetId: activeJobSetId,
        total: carouselTotal,
        items: carouselSubscription.items
      }
    });
  }, [
    carouselSubscription.done,
    carouselSubscription.items,
    activeCarouselMessageId,
    activeJobSetId,
    carouselTotal,
    updateMessage
  ]);

  useEffect(() => {
    return () => {
      const pollers = videoPollers.current;
      pollers.forEach((intervalId) => {
        window.clearInterval(intervalId);
      });
      pollers.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (uploadedImage) {
        URL.revokeObjectURL(uploadedImage);
      }
    };
  }, [uploadedImage]);

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    const id = buildId();
    setMessages((prev) => [...prev, { ...message, id }]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg)));
  }, []);

  const checkAndConsumeQuota = useCallback(
    async (type: 'woofs' | 'visuals', amount: number) => {
      if (!activeBrandId) {
        toast.error('Sélectionne une marque pour générer du contenu.');
        return false;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-quota', {
          body: { brand_id: activeBrandId }
        });

        if (error) {
          console.error('[AlfieChat] get-quota error', error);
          toast.error("Impossible de vérifier les quotas.");
          return false;
        }

        const remaining = type === 'woofs' ? data?.woofs_remaining ?? 0 : data?.visuals_remaining ?? 0;

        if (remaining < amount) {
          toast.error(`Quota insuffisant. Il te reste ${remaining} ${type === 'woofs' ? 'Woofs' : 'visuels'}.`);
          return false;
        }

        const endpoint = type === 'woofs' ? 'alfie-consume-woofs' : 'alfie-consume-visuals';
        const costKey = type === 'woofs' ? 'cost_woofs' : 'cost_visuals';

        const { error: consumeError } = await supabase.functions.invoke(endpoint, {
          body: {
            [costKey]: amount,
            brand_id: activeBrandId
          }
        });

        if (consumeError) {
          console.error('[AlfieChat] consume quota error', consumeError);
          toast.error("Impossible de consommer le quota.");
          return false;
        }

        return true;
      } catch (err) {
        console.error('[AlfieChat] quota error', err);
        toast.error("Erreur de quota, réessaie plus tard.");
        return false;
      }
    },
    [activeBrandId]
  );

  const refundWoofs = useCallback(
    async (amount: number) => {
      if (!activeBrandId || amount <= 0) return;
      try {
        await supabase.functions.invoke('alfie-refund-woofs', {
          body: { amount, brand_id: activeBrandId }
        });
      } catch (err) {
        console.error('[AlfieChat] refund woofs error', err);
      }
    },
    [activeBrandId]
  );

  const pollVideoStatus = useCallback(
    (messageId: string, jobId: string, woofCost: number) => {
      const poll = async () => {
        const { data, error } = await supabase
          .from('media_generations')
          .select('status, output_url, thumbnail_url')
          .eq('job_id', jobId)
          .maybeSingle();

        if (error) {
          console.error('[AlfieChat] video polling error', error);
          return;
        }

        if (!data) {
          return;
        }

        if (data.status === 'failed') {
          updateMessage(messageId, {
            content: 'La génération vidéo a échoué. Réessaie plus tard.',
            metadata: {
              status: 'failed',
              jobId
            }
          });
          await refundWoofs(woofCost);
          const intervalId = videoPollers.current.get(messageId);
          if (intervalId) {
            window.clearInterval(intervalId);
            videoPollers.current.delete(messageId);
          }
          return;
        }

        if (data.status === 'completed' && data.output_url) {
          updateMessage(messageId, {
            content: 'Vidéo générée !',
            metadata: {
              status: 'completed',
              jobId,
              outputUrl: data.output_url,
              thumbnailUrl: data.thumbnail_url
            } satisfies VideoStatus
          });
          const intervalId = videoPollers.current.get(messageId);
          if (intervalId) {
            window.clearInterval(intervalId);
            videoPollers.current.delete(messageId);
          }
        }
      };

      poll();

      const intervalId = window.setInterval(poll, 5000);
      videoPollers.current.set(messageId, intervalId);
    },
    [refundWoofs, updateMessage]
  );

  const generateImage = useCallback(
    async (prompt: string, aspectRatio: string) => {
      const hasQuota = await checkAndConsumeQuota('woofs', 1);
      if (!hasQuota) return;

      try {
        const { data, error } = await supabase.functions.invoke('alfie-render-image', {
          body: {
            provider: 'gemini-nano',
            prompt,
            format: aspectRatio,
            brand_id: activeBrandId,
            cost_woofs: 1
          }
        });

        if (error || !data?.data?.image_urls?.length) {
          toast.error("Impossible de générer l'image.");
          await refundWoofs(1);
          return;
        }

        const imageUrl = data.data.image_urls[0];
        addMessage({
          role: 'assistant',
          type: 'image',
          content: "Image générée !",
          assetUrl: imageUrl,
          assetId: data.data.generation_id,
          metadata: { aspectRatio }
        });
      } catch (err) {
        console.error('[AlfieChat] generateImage error', err);
        toast.error("Erreur lors de la génération de l'image.");
        await refundWoofs(1);
      }
    },
    [activeBrandId, addMessage, checkAndConsumeQuota, refundWoofs]
  );

  const generateVideo = useCallback(
    async (prompt: string, aspectRatio: string, woofCost: number) => {
      const hasQuota = await checkAndConsumeQuota('woofs', woofCost);
      if (!hasQuota) return;

      try {
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: {
            prompt,
            aspectRatio,
            brandId: activeBrandId,
            woofCost,
            imageUrl: uploadedImage ?? undefined
          }
        });

        if (error || !data?.jobId) {
          toast.error('Impossible de lancer la génération vidéo.');
          await refundWoofs(woofCost);
          return;
        }

        const messageId = addMessage({
          role: 'assistant',
          type: 'video',
          content: 'Vidéo en cours de génération…',
          metadata: {
            status: 'processing',
            jobId: data.jobId,
            predictionId: data.predictionId
          } satisfies VideoStatus
        });

        pollVideoStatus(messageId, data.jobId, woofCost);
      } catch (err) {
        console.error('[AlfieChat] generateVideo error', err);
        toast.error('Erreur lors de la génération vidéo.');
        await refundWoofs(woofCost);
      }
    },
    [activeBrandId, addMessage, checkAndConsumeQuota, pollVideoStatus, refundWoofs, uploadedImage]
  );

  const triggerWorker = useCallback(async () => {
    try {
      await supabase.functions.invoke('process-job-worker');
    } catch (err) {
      console.error('[AlfieChat] triggerWorker error', err);
    }
  }, []);

  const generateCarousel = useCallback(
    async (prompt: string, count: number, aspectRatio: string) => {
      const hasQuota = await checkAndConsumeQuota('visuals', count);
      if (!hasQuota) return;

      try {
        const { data, error } = await supabase.functions.invoke('create-job-set', {
          body: {
            brandId: activeBrandId,
            prompt,
            count,
            aspectRatio
          }
        });

        if (error || !data?.data?.id) {
          toast.error('Impossible de créer le carrousel.');
          return;
        }

        const jobSetId = data.data.id as string;
        setActiveJobSetId(jobSetId);
        setCarouselTotal(count);
        setCarouselDone(0);

        const messageId = addMessage({
          role: 'assistant',
          type: 'carousel',
          content: `Génération de ${count} slides en cours…`,
          metadata: {
            jobSetId,
            total: count,
            items: []
          } satisfies CarouselMetadata
        });

        setActiveCarouselMessageId(messageId);

        await triggerWorker();
      } catch (err) {
        console.error('[AlfieChat] generateCarousel error', err);
        toast.error('Erreur lors de la génération du carrousel.');
      }
    },
    [activeBrandId, addMessage, checkAndConsumeQuota, triggerWorker]
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) {
      return;
    }

    const prompt = input.trim();
    setInput('');
    setIsLoading(true);

    addMessage({
      role: 'user',
      type: 'text',
      content: prompt
    });

    const intent = detectIntent(prompt);
    const aspectRatio = detectAspectRatio(prompt);

    try {
      if (intent === 'image') {
        await generateImage(prompt, aspectRatio);
      } else if (intent === 'video') {
        const woofCost = detectVideoCost(prompt);
        await generateVideo(prompt, aspectRatio, woofCost);
      } else {
        const count = detectCarouselCount(prompt);
        await generateCarousel(prompt, count, aspectRatio);
      }
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, generateCarousel, generateImage, generateVideo, input, isLoading]);

  const layoutClasses = useMemo(() => {
    if (variant === 'widget') {
      return 'flex h-full flex-col bg-white';
    }
    return 'flex h-full flex-col bg-background';
  }, [variant]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Seules les images sont supportées comme référence.");
      return;
    }

    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage);
    }

    const url = URL.createObjectURL(file);
    setUploadedImage(url);
  }, [uploadedImage]);

  const removeUploadedImage = useCallback(() => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage);
    }
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadedImage]);

  return (
    <Card className={`${layoutClasses} border-none shadow-none`}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Assistant créatif</p>
          <h2 className="text-lg font-semibold">Alfie Chat</h2>
        </div>
        {onClose ? (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer le chat">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="px-4 py-2">
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <Badge
              key={prompt}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => setInput(prompt)}
            >
              {prompt}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <MessageContent message={message} carouselDone={carouselDone} />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {uploadedImage ? (
        <div className="px-4">
          <div className="relative mt-2 overflow-hidden rounded-lg border">
            <img src={uploadedImage} alt="Référence uploadée" className="h-32 w-full object-cover" />
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6 rounded-full"
              onClick={removeUploadedImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2 px-4 py-4">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Décris ce que tu veux créer…"
          rows={3}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-4 w-4" /> Référence visuelle
            </Button>
            {variant === 'page' && carouselTotal > 0 ? (
              <span className="text-xs text-muted-foreground">
                Carrousel : {carouselDone}/{carouselTotal} slides
              </span>
            ) : null}
          </div>
          <Button type="button" onClick={handleSend} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Envoyer
          </Button>
        </div>
      </div>
    </Card>
  );
}

type MessageContentProps = {
  message: Message;
  carouselDone: number;
};

function MessageContent({ message, carouselDone }: MessageContentProps) {
  if (message.type === 'image' && message.assetUrl) {
    return (
      <div className="space-y-2">
        <p>{message.content}</p>
        <img
          src={message.assetUrl}
          alt="Visuel généré"
          className="w-full rounded-lg object-cover"
        />
      </div>
    );
  }

  if (message.type === 'video') {
    const metadata = message.metadata as VideoStatus | undefined;

    if (metadata?.status === 'completed' && metadata.outputUrl) {
      return (
        <div className="space-y-2">
          <p>{message.content}</p>
          <video
            controls
            className="w-full rounded-lg"
            src={metadata.outputUrl}
            poster={metadata.thumbnailUrl ?? undefined}
          />
        </div>
      );
    }

    if (metadata?.status === 'failed') {
      return <p>{message.content}</p>;
    }

    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{message.content}</span>
      </div>
    );
  }

  if (message.type === 'carousel') {
    const metadata = message.metadata as CarouselMetadata | undefined;
    const done = metadata?.items?.length ?? carouselDone;
    const total = metadata?.total ?? 0;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 text-xs uppercase text-muted-foreground">
          <span>{message.content}</span>
          {total > 0 ? <span>{done}/{total}</span> : null}
        </div>
        {metadata?.items?.length ? (
          <div className="grid grid-cols-2 gap-2">
            {metadata.items.map((item) => (
              <img
                key={item.id}
                src={item.url}
                alt={`Slide ${item.index + 1}`}
                className="h-32 w-full rounded-lg object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Génération en cours…</span>
          </div>
        )}
      </div>
    );
  }

  return <p className="whitespace-pre-line">{message.content}</p>;
}
