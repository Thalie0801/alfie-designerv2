import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  cta?: 'open-studio';
};

export type AlfieIntent = 'none' | 'image' | 'video' | 'carousel';

export interface PlannedBrief {
  intent: AlfieIntent;
  topic?: string;
  channel?: string;
  format?: string;
  tone?: string;
  quantity?: number;
}

type AlfieChatMode = 'widget' | 'studio';

type AlfieChatMode = 'widget' | 'studio';

type AlfieChatProps = {
  variant?: 'page' | 'widget';
  onClose?: () => void;
  mode?: AlfieChatMode;
  initialBrief?: PlannedBrief;
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

const STUDIO_WELCOME_MESSAGE: Message = {
  id: 'welcome-studio',
  role: 'assistant',
  type: 'text',
  content:
    "👋 Salut ! Je suis Alfie. Je peux générer des **images**, des **vidéos** ou des **carrousels** pour ta marque. Décris-moi ce que tu veux créer."
};

const WIDGET_WELCOME_MESSAGE: Message = {
  id: 'welcome-widget',
  role: 'assistant',
  type: 'text',
  content:
    "👋 Salut ! Je suis Alfie, ton coach créatif. Raconte-moi ton idée et on prépare ensemble un brief aux petits oignons avant de lancer la génération dans le Studio."
};

const STUDIO_PATH = '/studio';

function detectIntent(prompt: string): AlfieIntent {
const STUDIO_REDIRECT_MESSAGE =
  "On va faire ça dans le Studio pour que tu aies les bons réglages de marque, ratios, quotas, etc. Clique sur « Ouvrir le Studio » pour lancer la génération.";

const STUDIO_PATH = '/studio';

function detectIntent(prompt: string): Intent {
  const lower = prompt.toLowerCase();

  if (/(carrousel|carousel|slides|diapos?)/.test(lower)) {
    return 'carousel';
  }

  if (/(vidéo|video|reel|short|story|tiktok|youtube|clip)/.test(lower)) {
    return 'video';
  }

  if (/(image|visuel|illustration|mockup|affiche)/.test(lower)) {
    return 'image';
  }

  return 'none';
}

function extractTopic(message: string): string | undefined {
  const cleaned = message
    .replace(/(1:1|4:5|9:16|16:9)/gi, '')
    .replace(/\b(instagram|tik\s?tok|pinterest|linkedin|facebook|youtube|twitter|x|snapchat|newsletter|site web|blog)\b/gi, '')
    .replace(/\b(image|images|vidéo|vidéos|video|videos|carrousel|carousel|slides?|diapos?|visuels?|contenu|post|publication|pub|campagne)\b/gi, '')
    .replace(/\b(crée|créer|fais|faire|génère|générer|prépare|préparer|montre|donne-moi|peux-tu|voudrais|j'aimerais)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || /je ne sais pas|aucune idée|propose|surprends-moi/i.test(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function extractQuantity(message: string): number | undefined {
  const lower = message.toLowerCase();
  const numericMatch = lower.match(/(\d+)\s*(?:images?|visuels?|slides?|diapos?|carrousels?|vidéos?)/i);

  if (numericMatch) {
    const value = parseInt(numericMatch[1], 10);
    if (!Number.isNaN(value) && value > 0) {
      return value;
    }
  }

  const words: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10
  };

  const wordMatch = lower.match(
    /\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b\s*(?:images?|visuels?|slides?|diapos?|carrousels?|vidéos?)/
  );

  if (wordMatch) {
    const value = words[wordMatch[1]];
    if (value) return value;
  }

  if (/(quelques|plusieurs|une série)/.test(lower)) {
    return 3;
  }

  return undefined;
}

function extractChannel(message: string): string | undefined {
  const channels: Record<string, string> = {
    instagram: 'Instagram',
    'tik tok': 'TikTok',
    tiktok: 'TikTok',
    pinterest: 'Pinterest',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    youtube: 'YouTube',
    newsletter: 'Newsletter',
    blog: 'Blog',
    snapchat: 'Snapchat',
    twitter: 'Twitter',
    x: 'X'
  };

  const lower = message.toLowerCase();

  for (const key of Object.keys(channels)) {
    if (lower.includes(key)) {
      return channels[key];
    }
  }

  return undefined;
}

function extractFormat(message: string): string | undefined {
  const ratioMatch = message.match(/(1:1|4:5|9:16|16:9)/);
  if (ratioMatch) {
    return ratioMatch[1];
  }

  if (/(story|reel|short|vertical|portrait)/i.test(message)) {
    return '9:16';
  }

  if (/(youtube|horizontal|paysage|wide)/i.test(message)) {
    return '16:9';
  }

  if (/(carré|square)/i.test(message)) {
    return '1:1';
  }

  return undefined;
}

function extractTone(message: string): string | undefined {
  const lower = message.toLowerCase();
  const toneMap: Record<string, string> = {
    fun: 'fun',
    drôle: 'fun',
    ludique: 'fun',
    pro: 'professionnel',
    professionnel: 'professionnel',
    sérieuse: 'professionnel',
    sérieux: 'professionnel',
    luxe: 'luxe',
    premium: 'luxe',
    minimaliste: 'minimaliste',
    dynamique: 'dynamique',
    énergique: 'dynamique',
    inspirant: 'inspirant',
    inspiration: 'inspirant'
  };

  for (const key of Object.keys(toneMap)) {
    if (lower.includes(key)) {
      return toneMap[key];
    }
  }

  return undefined;
}

function userIsOutOfIdeas(message: string): boolean {
  return /(je ne sais pas|aucune idée|pas d'idée|propose|inspire|surprends-moi|à toi|choisis pour moi)/i.test(message);
}

function buildSuggestions(intent: AlfieIntent): string[] {
  if (intent === 'video') {
    return [
      'Vidéo 9:16 « 3 astuces pour booster ta visibilité » avec un hook punchy au début',
      'Vidéo format Reels présentant ton produit en 15 secondes, ton dynamique',
      'Clip 16:9 « Avant / Après » pour une campagne YouTube courte et impactante'
    ];
  }

  if (intent === 'carousel') {
    return [
      'Carrousel 5 slides : Les erreurs à éviter pour réussir son lancement',
      'Carrousel 4 slides : Ton plan d’action en 4 étapes clés',
      'Carrousel 6 slides : Témoignage client + bénéfices produit'
    ];
  }

  return [
    'Visuel hero 1:1 avec ton produit en scène principale',
    'Mockup lifestyle montrant ton offre dans un univers réaliste',
    'Avant / Après pour illustrer l’impact de ta solution'
  ];
}

function isBriefReady(brief: PlannedBrief | null): brief is PlannedBrief {
  if (!brief) return false;
  if (!brief.intent || brief.intent === 'none') return false;
  if (!brief.topic) return false;
  if (!brief.channel && !brief.format) return false;
  return true;
}

function getNextQuestion(brief: PlannedBrief): string | null {
  if (!brief.topic) {
    return "Dis-moi en quelques mots ce que tu veux mettre en avant dans ce contenu.";
  }

  if (!brief.channel && !brief.format) {
    return "C’est pour quel réseau (Instagram, TikTok, Pinterest...)?";
  }

  if (!brief.format) {
    return "Tu as un format ou un ratio préféré (1:1, 9:16, 16:9...)?";
  }

  if (!brief.tone) {
    return "Quel ton veux-tu donner (fun, pro, luxe...)?";
  }

  if (!brief.quantity) {
    if (brief.intent === 'carousel') {
      return "Tu veux combien de slides pour ce carrousel?";
    }
    if (brief.intent === 'image') {
      return "Tu veux combien de visuels différents?";
    }
  }

  return null;
}

function extractBriefDetails(message: string): Omit<PlannedBrief, 'intent'> {
  const topic = extractTopic(message);
  const channel = extractChannel(message);
  const format = extractFormat(message);
  const tone = extractTone(message);
  const quantity = extractQuantity(message);

  return { topic, channel, format, tone, quantity };
}

function savePlannedBriefToStorage(brief: PlannedBrief) {
  try {
    localStorage.setItem('alfie_planned_brief', JSON.stringify(brief));
  } catch (err) {
    console.error('Failed to persist planned brief', err);
  }
}

function buildPromptFromBrief(brief: PlannedBrief): string {
  const parts: string[] = [];

  if (brief.topic) {
    parts.push(brief.topic);
  }

  if (brief.channel) {
    parts.push(`pour ${brief.channel}`);
  }

  if (brief.format) {
    parts.push(`format ${brief.format}`);
  }

  if (brief.tone) {
    parts.push(`ton ${brief.tone}`);
  }

  if (brief.intent === 'carousel' && brief.quantity) {
    parts.push(`${brief.quantity} slides`);
  } else if (brief.intent === 'image' && brief.quantity && brief.quantity > 1) {
    parts.push(`${brief.quantity} visuels`);
  }

  return parts.join(' — ');
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

export function AlfieChat({ variant = 'page', onClose, mode = 'studio', initialBrief }: AlfieChatProps) {
export function AlfieChat({ variant = 'page', onClose, mode = 'studio' }: AlfieChatProps) {
  const { activeBrandId } = useBrandKit();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>(() => [
    mode === 'widget' ? WIDGET_WELCOME_MESSAGE : STUDIO_WELCOME_MESSAGE
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showStudioCta, setShowStudioCta] = useState(false);
  const [plannedBrief, setPlannedBrief] = useState<PlannedBrief | null>(null);
  const [hasSuggestedStudio, setHasSuggestedStudio] = useState(false);
  const [studioBrief, setStudioBrief] = useState<PlannedBrief | null>(null);
  const [hasHydratedInitialBrief, setHasHydratedInitialBrief] = useState(false);

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

  useEffect(() => {
    if (mode !== 'studio') return;
    if (!initialBrief) return;
    if (hasHydratedInitialBrief) return;

    const promptFromBrief = buildPromptFromBrief(initialBrief);
    setInput((prev) => (prev ? prev : promptFromBrief));
    setStudioBrief(initialBrief);
    setHasHydratedInitialBrief(true);
  }, [initialBrief, mode, hasHydratedInitialBrief]);

  useEffect(() => {
    if (mode !== 'widget') return;

    if (!plannedBrief) {
      setShowStudioCta(false);
      setHasSuggestedStudio(false);
      return;
    }

    if (!isBriefReady(plannedBrief)) {
      return;
    }

    savePlannedBriefToStorage(plannedBrief);
    setShowStudioCta(true);

    if (!hasSuggestedStudio) {
      addAssistantMessage(
        "Super, j’ai tout ce qu’il faut. Je te propose de passer dans le Studio pour lancer la génération. Clique sur le bouton ci-dessous.",
        { cta: 'open-studio' }
      );
      setHasSuggestedStudio(true);
    }
  }, [plannedBrief, mode, hasSuggestedStudio, addAssistantMessage]);

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    const id = buildId();
    setMessages((prev) => [...prev, { ...message, id }]);
    return id;
  }, []);

  const addAssistantMessage = useCallback(
    (content: string, options: Partial<Omit<Message, 'id' | 'role'>> = {}) => {
      return addMessage({
        role: 'assistant',
        type: options.type ?? 'text',
        content,
        cta: options.cta,
        metadata: options.metadata,
        assetId: options.assetId,
        assetUrl: options.assetUrl
      });
    },
    [addMessage]
  );

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

  const handleWidgetConversation = useCallback(
    (intent: AlfieIntent, prompt: string) => {
      if (mode !== 'widget') return;

      if (plannedBrief?.intent && userIsOutOfIdeas(prompt)) {
        const suggestions = buildSuggestions(plannedBrief.intent);
        const ideas = suggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`).join('\n');
        addAssistantMessage(
          "Pas de souci, je peux t’inspirer ! Voici quelques idées :\n" +
            ideas +
            "\nTu veux que je prépare l’une d’elles dans le Studio ? Dis-moi le numéro ou reformule à ta façon."
        );
        return;
      }

      const details = extractBriefDetails(prompt);
      const hadBrief = Boolean(plannedBrief);

      if (intent === 'none' && !hadBrief) {
        addAssistantMessage(
          "Ravi d’échanger avec toi ! Tu préfères qu’on prépare une image, une vidéo ou un carrousel ?"
        );
        return;
      }

      let updatedBrief: PlannedBrief | null = plannedBrief ?? null;
      let isNewIntent = false;

      setPlannedBrief((prev) => {
        if (intent !== 'none') {
          isNewIntent = !prev || prev.intent !== intent;
          const next: PlannedBrief = {
            intent,
            topic: details.topic ?? prev?.topic ?? extractTopic(prompt),
            channel: details.channel ?? prev?.channel,
            format: details.format ?? prev?.format,
            tone: details.tone ?? prev?.tone,
            quantity: details.quantity ?? prev?.quantity
          };
          updatedBrief = next;
          return next;
        }

        if (!prev) {
          updatedBrief = prev ?? null;
          return prev;
        }

        const next: PlannedBrief = {
          ...prev,
          topic: details.topic ?? prev.topic,
          channel: details.channel ?? prev.channel,
          format: details.format ?? prev.format,
          tone: details.tone ?? prev.tone,
          quantity: details.quantity ?? prev.quantity
        };

        if (
          next.topic === prev.topic &&
          next.channel === prev.channel &&
          next.format === prev.format &&
          next.tone === prev.tone &&
          next.quantity === prev.quantity
        ) {
          updatedBrief = prev;
          return prev;
        }

        updatedBrief = next;
        return next;
      });

      if (isNewIntent) {
        setHasSuggestedStudio(false);
        setShowStudioCta(false);
      }

      if (!updatedBrief) {
        addAssistantMessage(
          "Je suis là pour t’aider à préparer ton brief. Dis-moi si tu veux qu’on travaille sur une image, une vidéo ou un carrousel."
        );
        return;
      }

      let assistantMessage: string | null = null;

      if (intent !== 'none') {
        const question = getNextQuestion(updatedBrief);
        assistantMessage = question
          ? `Top, on va préparer ça ensemble. ${question}`
          : "Top, on va préparer ça ensemble. Ajoute les derniers détails si besoin et je m’occupe du reste !";
      } else {
        const question = getNextQuestion(updatedBrief);
        if (question) {
          assistantMessage = question;
        } else {
          assistantMessage = hasSuggestedStudio
            ? "Parfait, j’ai mis le brief à jour. Tu peux lancer le Studio quand tu veux."
            : "Super, je note tout. Dis-moi quand tu veux que je finalise et on passera dans le Studio pour générer.";
        }
      }

      if (assistantMessage) {
        addAssistantMessage(assistantMessage);
      }
    },
    [
      mode,
      plannedBrief,
      addAssistantMessage,
      setPlannedBrief,
      setHasSuggestedStudio,
      setShowStudioCta,
      hasSuggestedStudio
    ]
  const replyAsAssistant = useCallback(
    async (intent: Intent) => {
      const needsStudio = intent === 'image' || intent === 'video' || intent === 'carousel';

      addMessage({
        role: 'assistant',
        type: 'text',
        content: needsStudio ? STUDIO_REDIRECT_MESSAGE : "Je suis là pour t'aider à préparer ta prochaine création. Décris-moi ce que tu veux et on le fera ensemble dans le Studio !",
        cta: needsStudio ? 'open-studio' : undefined
      });

      setShowStudioCta(mode === 'widget' && needsStudio);
    },
    [addMessage, mode]
  );

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) {
      return;
    }

    const prompt = input.trim();
    setInput('');
    setIsLoading(true);
    setShowStudioCta(false);

    addMessage({
      role: 'user',
      type: 'text',
      content: prompt
    });

    const intent = detectIntent(prompt);

    try {
      if (mode === 'studio') {
        const resolvedIntent: AlfieIntent = intent === 'none' ? studioBrief?.intent ?? 'image' : intent;
        const aspectRatio = studioBrief?.format ?? detectAspectRatio(prompt);

        if (resolvedIntent === 'image') {
          await generateImage(prompt, aspectRatio);
        } else if (resolvedIntent === 'video') {
          const woofCost = detectVideoCost(prompt);
          await generateVideo(prompt, aspectRatio, woofCost);
        } else {
          const count = studioBrief?.quantity ?? detectCarouselCount(prompt);
          await generateCarousel(prompt, count, aspectRatio);
        }

        if (studioBrief) {
          setStudioBrief(null);
        }
      } else {
        handleWidgetConversation(intent, prompt);
        if (intent === 'image') {
          await generateImage(prompt, aspectRatio);
        } else if (intent === 'video') {
          const woofCost = detectVideoCost(prompt);
          await generateVideo(prompt, aspectRatio, woofCost);
        } else {
          const count = detectCarouselCount(prompt);
          await generateCarousel(prompt, count, aspectRatio);
        }
      } else {
        await replyAsAssistant(intent);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    addMessage,
    generateCarousel,
    generateImage,
    generateVideo,
    input,
    isLoading,
    mode,
    handleWidgetConversation,
    studioBrief
    replyAsAssistant
  ]);

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

      {mode === 'widget' && showStudioCta ? (
        <div className="px-4">
          <button
            className="mt-2 w-full rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            onClick={() => navigate(STUDIO_PATH)}
            type="button"
          >
            Ouvrir le Studio et préparer ça
            Ouvrir le Studio
          </button>
        </div>
      ) : null}

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
