import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useAlfieCredits } from '@/hooks/useAlfieCredits';
import { useTemplateLibrary } from '@/hooks/useTemplateLibrary';
import { useAlfieOptimizations } from '@/hooks/useAlfieOptimizations';
import { useCarouselSubscription } from '@/hooks/useCarouselSubscription';
import { supabase } from '@/integrations/supabase/client';
import { getAuthHeader } from '@/lib/auth';
import { detectIntent, canHandleLocally, generateLocalResponse } from '@/utils/alfieIntentDetector';
import { getQuotaStatus, formatExpirationMessage } from '@/utils/quotaManager';
import { JobPlaceholder, JobStatus } from '@/components/chat/JobPlaceholder';
import { AssetMessage } from '@/components/chat/AssetMessage';
import { CreateHeader } from '@/components/create/CreateHeader';
import { ChatComposer } from '@/components/create/ChatComposer';
import { QuotaBar } from '@/components/create/QuotaBar';
import { ChatBubble } from '@/components/create/ChatBubble';
import { CarouselProgressCard } from '@/components/chat/CarouselProgressCard';

type VideoEngine = 'sora' | 'seededance' | 'kling';

interface VideoProviderInfo {
  provider: string;
  engine: VideoEngine;
  statusProvider: string;
  providerInternal: string;
  label: string;
}

const resolveVideoProviderInfo = (raw: string | undefined): VideoProviderInfo => {
  const normalized = raw?.toLowerCase();

  switch (normalized) {
    case 'kling':
      return { provider: 'kling', engine: 'kling', statusProvider: 'kling', providerInternal: 'kling', label: 'Kling' };
    case 'sora':
      return { provider: 'sora', engine: 'sora', statusProvider: 'sora', providerInternal: 'kling', label: 'Sora2' };
    case 'animate':
    case 'ffmpeg-backend':
      return {
        provider: 'animate',
        engine: 'seededance',
        statusProvider: 'animate',
        providerInternal: 'animate',
        label: 'Animate'
      };
    case 'seededance':
      return {
        provider: 'seededance',
        engine: 'seededance',
        statusProvider: 'seededance',
        providerInternal: 'replicate',
        label: 'Seededance'
      };
    case 'replicate':
      return {
        provider: 'seededance',
        engine: 'seededance',
        statusProvider: 'seededance',
        providerInternal: 'replicate',
        label: 'Seededance'
      };
    default: {
      const fallback = normalized ?? 'seededance';
      const label = fallback
        .replace(/[_-]+/g, ' ')
        .replace(/(^|\s)\w/g, (m) => m.toUpperCase());
      return {
        provider: fallback,
        engine: 'seededance',
        statusProvider: fallback,
        providerInternal: fallback,
        label
      };
    }
  }
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  created_at?: string;
  jobId?: string;
  jobShortId?: string;
  jobStatus?: JobStatus;
  progress?: number;
  assetId?: string;
  assetType?: 'image' | 'video';
  outputUrl?: string;
  width?: number;
  height?: number;
  expiresAt?: string;
  engine?: string;
  woofsConsumed?: number;
}

// Fonction utilitaire centralisée pour vérifier et consommer les quotas
const checkAndConsumeQuota = async (
  supabase: any,
  type: 'visuals' | 'woofs',
  amount: number,
  brandId: string
): Promise<{ ok: boolean; remaining?: number; error?: string }> => {
  try {
    // 1. Vérifier le quota
    const headers = await getAuthHeader();
    const { data: quotaData, error: quotaError } = await supabase.functions.invoke('get-quota', {
      body: { brand_id: brandId },
      headers
    });
    
    if (quotaError || !quotaData) {
      return { ok: false, error: 'Impossible de vérifier les quotas' };
    }
    
    const quota = quotaData;
    const remaining = type === 'visuals' 
      ? quota.visuals_remaining 
      : quota.woofs_remaining;
    
    if (remaining < amount) {
      return { 
        ok: false, 
        remaining, 
        error: `Quota insuffisant. Il te reste ${remaining} ${type === 'visuals' ? 'visuels' : 'woofs'}.` 
      };
    }
    
    // 2. Consommer le quota
    const consumeEndpoint = type === 'woofs' 
      ? 'alfie-consume-woofs'
      : 'alfie-consume-visuals';
    
    const { error: consumeError } = await supabase.functions.invoke(consumeEndpoint, {
      body: { 
        cost_woofs: type === 'woofs' ? amount : undefined,
        cost_visuals: type === 'visuals' ? amount : undefined,
        brand_id: brandId 
      },
      headers
    });
    
    if (consumeError) {
      return { ok: false, error: 'Impossible de consommer les quotas' };
    }
    
    return { ok: true, remaining: remaining - amount };
  } catch (error: any) {
    console.error('[Quota] Error:', error);
    return { ok: false, error: error.message };
  }
};

const INITIAL_ASSISTANT_MESSAGE = `Salut ! 🐾 Je suis Alfie Designer, ton compagnon créatif IA 🎨

Je peux t'aider à :
• Créer des images IA (1 crédit + quota visuels par marque) ✨
• Générer des vidéos Sora2 (1 clip = 1 Woof, montage multi-clips possible) 🎬
• Adapter templates Canva (GRATUIT, Brand Kit inclus) 🎨
• Afficher tes quotas mensuels par marque (visuels, vidéos, Woofs) 📊
• Préparer tes assets en package ZIP 📦

📸 Tu peux me joindre une image pour :
• Faire une variation stylisée (image→image)
• Créer une vidéo à partir de l'image (image→vidéo)

🎬 Pour les vidéos :
• 10-12s loop = 1 Woof (1 clip Sora)
• ~20s = 2 Woofs (montage 2 clips)
• ~30s = 3 Woofs (montage 3 clips)

Chaque marque a ses propres quotas qui se réinitialisent le 1er du mois (non reportables).
Alors, qu'est-ce qu'on crée ensemble aujourd'hui ? 😊`;

export function AlfieChat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: INITIAL_ASSISTANT_MESSAGE
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAlfieThinking, setIsAlfieThinking] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [carouselPlan, setCarouselPlan] = useState<any>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{ type: string; message: string } | null>(null);
  const [composerHeight, setComposerHeight] = useState(192);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeJobSetId, setActiveJobSetId] = useState<string>('');
  const [carouselTotal, setCarouselTotal] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_videoJobId, _setVideoJobId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_currentSlideIndex, setCurrentSlideIndex] = useState<number>(0); // Used for tracking slide-by-slide validation flow
  const { items: carouselItems, done: carouselDone, refresh: refreshCarousel } = useCarouselSubscription(activeJobSetId, carouselTotal);
  const { brandKit, activeBrandId } = useBrandKit();
  const { totalCredits, decrementCredits, hasCredits, incrementGenerations } = useAlfieCredits();
  const { searchTemplates } = useTemplateLibrary();
  const {
    getCachedResponse,
    incrementRequests,
    requestsThisMonth,
    quota
  } = useAlfieOptimizations();

  // Worker pumping state/refs
  const pumpRef = useRef<number | null>(null);
  const pumpStartRef = useRef<number>(0);
  const latestRef = useRef({ done: 0, total: 0, jobSetId: '' });

  useEffect(() => {
    latestRef.current = { done: carouselDone, total: carouselTotal, jobSetId: activeJobSetId };
    if (carouselTotal > 0 && carouselDone >= carouselTotal) {
      if (pumpRef.current) {
        clearInterval(pumpRef.current);
        pumpRef.current = null;
      }
      // ✅ Nettoyer localStorage ET afficher le toast
      localStorage.removeItem('activeJobSetId');
      localStorage.removeItem('carouselTotal');
      
      toast.success(`🎉 Carrousel terminé ! ${carouselTotal} slides générées`);
      
      // ⚠️ NE PAS réinitialiser activeJobSetId/carouselTotal ici
      // pour permettre l'affichage du carrousel terminé
    }
  }, [carouselDone, carouselTotal, activeJobSetId]);
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoaded(true);
          return;
        }

        // Vérifier si on doit créer une nouvelle conversation (nettoyage quotidien)
        const { data: existing } = await supabase
          .from('alfie_conversations')
          .select('id, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let convId: string | null = null;
        let shouldCreateNew = false;

        if (existing) {
          const lastUpdate = new Date(existing.updated_at);
          const now = new Date();
          const hoursSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
          
          // Créer nouvelle conversation si plus de 24h ou si c'est une nouvelle session
          if (hoursSinceLastUpdate > 24) {
            shouldCreateNew = true;
          } else {
            convId = existing.id;
          }
        } else {
          shouldCreateNew = true;
        }

        if (shouldCreateNew) {
          const { data: created, error: createErr } = await supabase
            .from('alfie_conversations')
            .insert({ user_id: user.id, title: `Conversation ${new Date().toLocaleDateString('fr-FR')}` })
            .select('id')
            .maybeSingle();
          if (!createErr && created) {
            convId = created.id;
            // Seed du premier message assistant en base
            await supabase.from('alfie_messages').insert({
              conversation_id: convId,
              role: 'assistant',
              content: INITIAL_ASSISTANT_MESSAGE,
            });
            setMessages([{ role: 'assistant', content: INITIAL_ASSISTANT_MESSAGE }]);
          }
        } else if (convId) {
          // Charger les messages existants
          const { data: msgs } = await supabase
            .from('alfie_messages')
            .select('role, content, image_url, video_url, created_at, asset_id, asset_type, output_url, expires_at, engine, woofs_consumed')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });
          if (msgs && msgs.length > 0) {
            setMessages(msgs.map((m: any) => ({ 
              role: m.role, 
              content: m.content, 
              imageUrl: m.image_url,
              videoUrl: m.video_url,
              created_at: m.created_at,
              assetId: m.asset_id,
              assetType: m.asset_type as 'image' | 'video' | undefined,
              outputUrl: m.output_url,
              expiresAt: m.expires_at,
              engine: m.engine,
              woofsConsumed: m.woofs_consumed
            })));
          }
        }

        setConversationId(convId);
      } catch (e) {
        console.error('Init chat error:', e);
      } finally {
        setLoaded(true);
      }
    };

    init();
  }, []);

  // Restaurer le job set actif depuis localStorage (refresh/navigation)
  useEffect(() => {
    if (!loaded || activeJobSetId) return;
    
    // Tenter de restaurer le job set actif depuis localStorage
    const savedJobSetId = localStorage.getItem('activeJobSetId');
    const savedTotal = localStorage.getItem('carouselTotal');
    
    if (savedJobSetId && savedTotal) {
      console.log('[Carousel] Restoring from localStorage:', savedJobSetId);
      setActiveJobSetId(savedJobSetId);
      setCarouselTotal(parseInt(savedTotal, 10));
      // Refresh immédiat pour charger les images
      setTimeout(() => refreshCarousel(), 200);
    } else if (activeBrandId) {
      // Fallback: chercher le dernier job_set en cours pour cette marque
      const fetchLastJobSet = async () => {
        const { data: lastJobSet } = await supabase
          .from('job_sets')
          .select('id, total, status, created_at')
          .eq('brand_id', activeBrandId)
          .in('status', ['queued', 'processing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        // ✅ GARDE: Vérifier si le job_set est "fantôme" (queued sans jobs depuis >5min)
        if (lastJobSet) {
          const { count } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('job_set_id', lastJobSet.id);
          
          const ageMinutes = (Date.now() - new Date(lastJobSet.created_at).getTime()) / 60000;
          const isPhantom = (count ?? 0) === 0 && ageMinutes > 5;
          
          if (isPhantom) {
            console.log('[Carousel] Detected phantom job_set, auto-canceling:', lastJobSet.id);
            const { data: { session } } = await supabase.auth.getSession();
            await supabase.functions.invoke('cancel-job-set', {
              body: { jobSetId: lastJobSet.id },
              headers: { Authorization: `Bearer ${session?.access_token}` }
            });
            localStorage.removeItem('activeJobSetId');
            localStorage.removeItem('carouselTotal');
            toast.info('Ancien carrousel bloqué nettoyé, prêt à relancer.');
            return; // Ne pas restaurer
          }
          
          console.log('[Carousel] Found active job_set:', lastJobSet.id);
          setActiveJobSetId(lastJobSet.id);
          setCarouselTotal(lastJobSet.total || 0);
          localStorage.setItem('activeJobSetId', lastJobSet.id);
          localStorage.setItem('carouselTotal', (lastJobSet.total || 0).toString());
          setTimeout(() => refreshCarousel(), 200);
        }
      };
      
      fetchLastJobSet();
    }
  }, [loaded, activeJobSetId, activeBrandId, refreshCarousel]);

  // Scroll automatique avec scrollIntoView
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generationStatus]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      toast.error('Seules les images sont acceptées');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 5MB)');
      return;
    }

    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('chat-uploads')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(fileName);

      setUploadedImage(publicUrl);
      
      // Indexer l'image uploadée comme "source" (non comptée dans les quotas)
      if (activeBrandId && user?.id) {
        try {
          await supabase.from('media_generations').insert({
            user_id: user.id,
            brand_id: activeBrandId,
            type: 'image',
            prompt: 'Upload source depuis le chat',
            output_url: publicUrl,
            is_source_upload: true,
            status: 'completed'
          } as any);
        } catch (e) {
          console.warn('Insertion source upload échouée (non bloquant):', e);
        }
      }

      toast.success('Image ajoutée ! Elle sera utilisée lors de la génération. 📸');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeUploadedImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.info('Image retirée');
  };

  const handleToolCall = async (toolName: string, args: any): Promise<any> => {
    console.log('Tool call:', toolName, args);
    
    // New tool calls from alfie-chat
    switch (toolName) {
      case 'generate_video': {
        console.log('[Video] Generating video with:', args);
        
        try {
          const { data, error } = await supabase.functions.invoke('generate-video', {
            body: {
              prompt: args.prompt || args.script,
              aspectRatio: args.ratio || args.aspectRatio || '16:9',
              imageUrl: args.imageUrl,
              brandId: activeBrandId
            }
          });
          
          if (error) throw error;
          
          _setVideoJobId(data.jobId);
          setGenerationStatus({ 
            type: 'video', 
            message: '🎬 Génération vidéo en cours...' 
          });
          
          toast.success("Vidéo en cours de génération !");
          
          return { success: true, jobId: data.jobId };
        } catch (error: any) {
          console.error('[Video] Generation error:', error);
          toast.error("Erreur lors de la génération vidéo");
          return { error: error.message };
        }
      }
    }
    
    // ⚠️ PRE-ROUTING : Détecter si l'intention carrousel a été ignorée
    if (toolName === 'generate_image') {
      const lastUserMessage = messages[messages.length - 1]?.content || '';
      const isCarouselIntent = /(carrousel|carousel|slides|série)/i.test(lastUserMessage);
      
      if (isCarouselIntent) {
        console.error('[Routing] ❌ Carrousel détecté mais generate_image appelé !');
        console.error('[Routing] Dernier message utilisateur:', lastUserMessage);
        toast.error("⚠️ Tu as demandé un carrousel, pas une image unique. Reformule ta demande.");
        return { 
          error: "❌ Détection carrousel. Utilise le workflow carrousel (plan → validation → génération slide-by-slide).",
          suggestion: "Demande plutôt : 'Crée un carrousel de X slides sur [thème]'"
        };
      }
    }
    
    switch (toolName) {
      case 'browse_templates': {
        const templates = await searchTemplates({
          category: args.category,
          keywords: args.keywords,
          ratio: args.ratio,
          limit: args.limit || 5
        });
        return {
          templates: templates.map(t => ({
            id: t.id,
            title: t.title,
            image_url: t.image_url,
            canva_url: t.canva_url,
            category: t.category,
            fit_score: t.fit_score
          }))
        };
      }
      
      case 'show_brandkit': {
        return { brandKit: brandKit || { message: "Aucun Brand Kit configuré" } };
      }
      
      case 'open_canva': {
        // 🔥 Désactivé: Canva sera disponible via API bientôt
        return { 
          success: true, 
          message: "🎨 Canva sera bientôt disponible via API ! Pour l'instant, tu peux télécharger ton image et l'importer manuellement dans Canva." 
        };
      }
      
      case 'generate_ai_version': {
        const creditCost = 1; // Adaptation IA coûte 1 crédit
        
        if (!hasCredits(creditCost)) {
          return { error: "Crédits insuffisants", credits: 0 };
        }
        
        try {
          const { data, error } = await supabase.functions.invoke('alfie-generate-ai-image', {
            body: {
              templateImageUrl: args.template_image_url,
              brandKit: brandKit,
              prompt: args.style_instructions
            },
          });
          
          if (error) throw error;
          
          await decrementCredits(creditCost, 'ai_adaptation');
          const remainingCredits = totalCredits - creditCost;
          
          return {
            success: true,
            imageUrl: data.imageUrl,
            creditsRemaining: remainingCredits
          };
        } catch (error: any) {
          console.error('AI generation error:', error);
          return { error: error.message || "Erreur de génération" };
        }
      }
      
      case 'check_credits': {
        return { credits: totalCredits };
      }
      
      case 'generate_image': {
        console.log('[Image] generate_image called with:', args);
        
        try {
          // ⚠️ GUARD : Si le prompt contient "carrousel", bloquer et forcer plan_carousel
          const promptLower = args.prompt?.toLowerCase() || '';
          if (/(carrousel|carousel|slides|série)/i.test(promptLower)) {
            console.error('[Routing] ❌ BYPASS DETECTED: generate_image called with carousel keywords!');
            console.error('[Routing] Prompt:', args.prompt);
            toast.error("⚠️ Détection carrousel ! Utilise plan_carousel au lieu de generate_image.");
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: "⚠️ Pour créer un carousel, utilise plutôt la commande 'Crée-moi un carousel' avec ta description."
            }]);
            return { 
              error: "⚠️ Détection carrousel ! Utilise plan_carousel au lieu de generate_image." 
            };
          }
          
          // Vérifier qu'une marque est active
          if (!activeBrandId) {
            const errorMsg = "⚠️ Aucune marque active. Tu dois d'abord sélectionner ou créer une marque pour générer des images. Va dans ton profil pour configurer ta marque.";
            setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
            toast.error("Aucune marque active. Sélectionne ou crée une marque d'abord ! 🐾");
            return { error: "No active brand" };
          }
          
          if (!user?.id) {
            throw new Error("User not authenticated");
          }
          
          setGenerationStatus({ type: 'image', message: 'Génération de ton image en cours... ✨' });

          // Mapper les aspect ratios vers les formats attendus par alfie-render-image
          const mapAspectRatio = (ratio: string): string => {
            const mapping: Record<string, string> = {
              '1:1': '1024x1024',
              '4:5': '1024x1280',
              '9:16': '1024x1820',
              '16:9': '1820x1024',
              '3:4': '1024x1365',
              '4:3': '1365x1024'
            };
            return mapping[ratio] || '1024x1024';
          };

          console.log('[Image] Calling alfie-render-image with:', {
            provider: 'gemini-nano',
            prompt: args.prompt,
            format: mapAspectRatio(args.aspect_ratio || '1:1'),
            brand_id: activeBrandId
          });

          const { data, error } = await supabase.functions.invoke('alfie-render-image', {
            body: {
              provider: 'gemini-nano',
              prompt: args.prompt,
              format: mapAspectRatio(args.aspect_ratio || '1:1'),
              brand_id: activeBrandId,
              cost_woofs: 1
            },
          });

          if (error) {
            console.error('[Image] Generation error:', error);
            const errorMsg = error.message || 'Erreur inconnue';
            
            // User-friendly error messages
            let friendlyMsg = "❌ Génération échouée. ";
            if (errorMsg.includes('INSUFFICIENT_QUOTA')) {
              friendlyMsg += "Tu as atteint ton quota. Consulte ton quota dans ton profil.";
            } else if (errorMsg.includes('MISSING_AUTH')) {
              friendlyMsg += "Problème d'authentification. Reconnecte-toi.";
            } else if (errorMsg.includes('DEBIT_FAILED')) {
              friendlyMsg += "Impossible de débiter les Woofs. Vérifie ton solde.";
            } else {
              friendlyMsg += "Réessaie ou contacte le support.";
            }
            
            toast.error(friendlyMsg);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: friendlyMsg
            }]);
            setGenerationStatus(null);
            return { error: errorMsg };
          }

          // alfie-render-image renvoie { ok, data: { image_urls, generation_id, meta } }
          if (!data?.ok || !data?.data?.image_urls?.[0]) {
            const errMsg = data?.error || "Aucune image générée";
            toast.error(`Échec: ${errMsg}`);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `❌ Échec de génération: ${errMsg}`
            }]);
            setGenerationStatus(null);
            return { error: errMsg };
          }

          const imageUrl = data.data.image_urls[0];
          const generationId = data.data.generation_id;

          setGenerationStatus(null);

          // Si un generation_id est retourné, charger l'asset depuis la DB (déjà inséré par la fonction)
          if (generationId) {
            const { data: existingAsset, error: fetchError } = await supabase
              .from('media_generations')
              .select('id, output_url, expires_at, engine, cost_woofs')
              .eq('id', generationId)
              .single();

            if (fetchError || !existingAsset) {
              console.warn('Failed to fetch existing asset, using fallback');
            } else {
              const imageMessage = {
                role: 'assistant' as const,
                content: `Image générée avec succès ! ✨`,
                assetId: existingAsset.id,
                assetType: 'image' as const,
                outputUrl: existingAsset.output_url,
                expiresAt: existingAsset.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                engine: existingAsset.engine || 'gemini-nano',
                woofsConsumed: existingAsset.cost_woofs || 1
              };
              
              setMessages(prev => [...prev, imageMessage]);
              
              // Persister le message avec assetId en base
              if (conversationId) {
                await supabase.from('alfie_messages').insert({
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: imageMessage.content,
                  image_url: existingAsset.output_url,
                  asset_id: existingAsset.id,
                  asset_type: 'image',
                  output_url: existingAsset.output_url,
                  expires_at: imageMessage.expiresAt,
                  engine: imageMessage.engine,
                  woofs_consumed: imageMessage.woofsConsumed
                });
              }
              
              await incrementGenerations();
              
              return {
                success: true,
                assetId: existingAsset.id,
                imageUrl: existingAsset.output_url
              };
            }
          }

          // Fallback : afficher l'image même si generation_id manque
          const fallbackMessage = {
            role: 'assistant' as const,
            content: `Image générée avec succès ! ✨`,
            imageUrl: imageUrl
          };
          
          setMessages(prev => [...prev, fallbackMessage]);
          
          await incrementGenerations();
          
          return {
            success: true,
            imageUrl: imageUrl
          };
        } catch (error: any) {
          console.error('Image generation error:', error);
          setGenerationStatus(null);
          toast.error("Erreur lors de la génération.");
          return { error: error.message || "Erreur de génération" };
        }
      }
      
      case 'improve_image': {
        try {
          setGenerationStatus({ type: 'image', message: 'Amélioration de ton image en cours... 🪄' });

          const { data, error } = await supabase.functions.invoke('improve-image', {
            body: { imageUrl: args.image_url, prompt: args.instructions },
          });

          if (error) throw error;

          if (!activeBrandId) {
            throw new Error("No active brand. Please select a brand first.");
          }
          
          if (!user?.id) {
            throw new Error("User not authenticated");
          }

          await supabase.from('media_generations').insert({
            user_id: user.id,
            brand_id: activeBrandId,
            type: 'image',
            prompt: args.instructions,
            input_url: args.image_url,
            output_url: data.imageUrl,
            status: 'completed'
          } as any);

          // Déduire 1 crédit pour l'amélioration d'image
          await decrementCredits(1, 'image_improvement');
          // Incrémenter le compteur de générations
          await incrementGenerations();

          setGenerationStatus(null);

          const imageMessage = {
            role: 'assistant' as const,
            content: `Image améliorée avec succès ! (1 crédit utilisé) 🪄`,
            imageUrl: data.imageUrl
          };
          
          setMessages(prev => [...prev, imageMessage]);
          
          // Persister le message image en base
          if (conversationId) {
            await supabase.from('alfie_messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: imageMessage.content,
              image_url: data.imageUrl
            });
          }

          return {
            success: true,
            imageUrl: data.imageUrl
          };
        } catch (error: any) {
          console.error('Image improvement error:', error);
          setGenerationStatus(null);
          return { error: error.message || "Erreur d'amélioration" };
        }
      }
      
      case 'generate_video': {
        try {
          console.log('🎬 [generate_video] Starting with args:', args);

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          // Appel backend (Edge Function)
          const { data, error } = await supabase.functions.invoke('generate-video', {
            body: {
              prompt: args.prompt,
              aspectRatio: args.aspectRatio || '16:9',
              imageUrl: args.imageUrl,
              durationPreference: args.durationPreference || 'short',
              woofCost: 2
            },
          });

          if (error) throw new Error(error.message || 'Erreur backend');
          if (!data) throw new Error('Payload backend vide');

          // Helpers pour typer proprement des champs "souvent pas propres"
          const str = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined);

          // Compat payloads (Replicate/Kie/agrégateurs)
          const predictionId =
            str((data as any).id) ||
            str((data as any).predictionId) ||
            str((data as any).prediction_id);

          const providerRaw =
            str((data as any).provider) ||
            str((data as any).engine) ||
            ((data as any).metadata && str(((data as any).metadata as any).provider));

          const provider = providerRaw?.toLowerCase(); // 'replicate' | 'kling' | 'sora' | 'seededance'...
          const providerInfo = resolveVideoProviderInfo(provider);

          const jobIdentifier =
            str((data as any).jobId) ||
            str((data as any).job_id) ||
            str((data as any).task_id) ||
            predictionId;

          const jobShortId = str((data as any).jobShortId);

          if (!predictionId || !providerInfo.provider) {
            console.error('❌ [generate_video] Invalid response payload:', data);
            throw new Error('Réponse vidéo invalide (id prédiction ou provider manquant). Vérifie les secrets Lovable Cloud.');
          }

          if (!activeBrandId) {
            throw new Error("No active brand. Please select a brand first.");
          }
          
          if (!user?.id) {
            throw new Error("User not authenticated");
          }

          // Créer l'asset en DB (status processing) — 2 Woofs / vidéo
          const { data: asset, error: assetError } = await supabase
            .from('media_generations')
            .insert([{ 
              user_id: user.id,
              brand_id: activeBrandId,
              type: 'video',
              engine: providerInfo.engine,
              status: 'processing',
              prompt: args.prompt,
              woofs: 2,
              output_url: '',
              job_id: null,
              metadata: {
                predictionId,
                provider: providerInfo.provider,
                providerResolved: providerInfo.provider,
                providerInternal: providerInfo.providerInternal,
                providerStatus: providerInfo.statusProvider,
                jobId: jobIdentifier ?? null,
                jobShortId: jobShortId ?? null,
                durationPreference: args.durationPreference || 'short',
                aspectRatio: args.aspectRatio || '16:9',
                woofCost: 2
              }
            } as any])
            .select()
            .single();

          if (assetError) throw assetError;

          // ✅ Décrémenter les Woofs seulement après le start réussi
          const { data: profile } = await supabase
            .from('profiles')
            .select('woofs_consumed_this_month')
            .eq('id', user.id)
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({ woofs_consumed_this_month: (profile.woofs_consumed_this_month || 0) + 2 })
              .eq('id', user.id);
          }

          const providerName = providerInfo.label;

          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🎬 Génération vidéo lancée avec ${providerName} ! (2 Woofs)\n\nJe te tiens au courant dès que c'est prêt.`,
            jobId: jobIdentifier ?? predictionId,
            jobShortId,
            assetId: asset.id,
            jobStatus: 'processing' as JobStatus,
            assetType: 'video'
          }]);

          return { success: true, assetId: asset.id, provider: providerInfo.statusProvider };
        } catch (error: any) {
          console.error('[generate_video] Error:', error);
          const errorMessage = error?.message || "Erreur inconnue";
          toast.error(`Échec génération vidéo: ${errorMessage}`);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `❌ Erreur vidéo: ${errorMessage}\n\nVérifie les logs et les secrets backend (KIE_API_KEY, REPLICATE_API_TOKEN).`
          }]);
          return { error: errorMessage };
        }
      }

      case 'show_usage': {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");
          
          if (!activeBrandId) {
            return { error: "Aucune marque active. Crée d'abord un Brand Kit !" };
          }

          const quotaStatus = await getQuotaStatus(activeBrandId);
          if (!quotaStatus) throw new Error("Impossible de récupérer les quotas");

          return {
            success: true,
            brandName: quotaStatus.brandName,
            plan: quotaStatus.plan,
            resetsOn: quotaStatus.resetsOn,
            quotas: {
              visuals: {
                used: quotaStatus.visuals.used,
                limit: quotaStatus.visuals.limit,
                percentage: quotaStatus.visuals.percentage.toFixed(1)
              },
              videos: {
                used: quotaStatus.videos.used,
                limit: quotaStatus.videos.limit,
                percentage: quotaStatus.videos.percentage.toFixed(1)
              },
              woofs: {
                consumed: quotaStatus.woofs.consumed,
                remaining: quotaStatus.woofs.remaining,
                limit: quotaStatus.woofs.limit
              }
            }
          };
        } catch (error: any) {
          console.error('Show usage error:', error);
          return { error: error.message || "Erreur d'affichage des quotas" };
        }
      }

      case 'adapt_template': {
        // 🔥 Désactivé: Canva sera disponible via API bientôt
        return { 
          success: true, 
          message: "🎨 L'adaptation de templates Canva sera bientôt disponible via API ! En attendant, tu peux utiliser les templates directement sur Canva." 
        };
      }

      case 'package_download': {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          // Récupérer les assets selon le filtre
          const filterType = args.filter_type || 'all';
          let query = supabase
            .from('media_generations')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('created_at', { ascending: false });

          if (filterType === 'images') {
            query = query.in('type', ['image', 'improved_image']);
          } else if (filterType === 'videos') {
            query = query.eq('type', 'video');
          }

          if (args.asset_ids && args.asset_ids.length > 0) {
            query = query.in('id', args.asset_ids);
          }

          const { data: assets, error } = await query;
          if (error) throw error;

          // Ajouter les messages d'expiration
          const assetsWithExpiration = assets?.map(a => ({
            id: a.id,
            type: a.type,
            url: a.output_url,
            created_at: a.created_at,
            expires_at: a.expires_at,
            expiration_message: a.expires_at ? formatExpirationMessage(a.expires_at) : null
          })) || [];

          return {
            success: true,
            assets: assetsWithExpiration,
            message: `Package prêt avec ${assets?.length || 0} assets ! 📦\n\n${assetsWithExpiration[0]?.expiration_message || ''}`
          };
        } catch (error: any) {
          console.error('Package download error:', error);
          return { error: error.message || "Erreur de préparation du package" };
        }
      }

      case 'create_carousel': {
        try {
          const { prompt, count = 5, aspect_ratio = '1:1' } = args;
          
          if (!activeBrandId) {
            return { error: "Aucune marque active. Crée d'abord un Brand Kit !" };
          }
          
          const quotaStatus = await getQuotaStatus(activeBrandId);
          const remaining = quotaStatus ? quotaStatus.visuals.limit - quotaStatus.visuals.used : 0;
          if (!quotaStatus || remaining < count) {
            return { 
              error: `Quota insuffisant. Il te reste ${remaining} visuels, mais tu demandes ${count} slides.` 
            };
          }
          
          // ✅ Vérifier la marque active avant l'appel
          console.log('[Carousel] Calling chat-create-carousel with:', { 
            activeBrandId, 
            slideCount: count, 
            hasUser: !!user 
          });
          
          if (!activeBrandId) {
            toast.error('Aucune marque active. Sélectionne une marque d\'abord.');
            return;
          }
          
          // ✅ Appeler directement create-job-set (il crée le set + les jobs)
          console.log('[Carousel] Calling create-job-set:', { brandId: activeBrandId, prompt, count, aspect_ratio });
          
          let jobSetId: string | null = null;
          
          try {
            const headers = await getAuthHeader();
            const { data, error } = await supabase.functions.invoke('create-job-set', {
              body: { 
                brandId: activeBrandId, 
                prompt, 
                count, 
                aspectRatio: aspect_ratio,
                ...(uploadedImage ? { styleRef: uploadedImage } : {})
              },
              headers: {
                ...headers,
                'x-idempotency-key': crypto.randomUUID()
              }
            });

            // Flexible reading of job_set_id from response
            const jobSetPayload = data;
            const createdJobSetId = jobSetPayload?.data?.id ?? jobSetPayload?.id;

            if (error || !createdJobSetId) {
              console.error('[Carousel] create-job-set failed:', error);
              toast.error('Impossible de créer le carrousel. Veuillez réessayer.');
              
              // Reset complet de l'état
              setActiveJobSetId('');
              setCarouselTotal(0);
              localStorage.removeItem('activeJobSetId');
              localStorage.removeItem('carouselTotal');
              
              return { error: 'Échec de création du carrousel' };
            }

            jobSetId = createdJobSetId;
            console.log('[Carousel] ✅ create-job-set succeeded, jobSetId:', jobSetId);
            
            if (!jobSetId) {
              console.error('[Carousel] jobSetId is null despite success');
              toast.error('Erreur: ID du carrousel manquant.');
              return { error: 'ID manquant' };
            }
            
            // ✅ Mettre à jour le state et vérifier immédiatement
            setActiveJobSetId(jobSetId);
            setCarouselTotal(count);
            localStorage.setItem('activeJobSetId', jobSetId);
            localStorage.setItem('carouselTotal', count.toString());
            
            console.log('[Carousel] State updated:', { 
              activeJobSetId: jobSetId, 
              carouselTotal: count,
              localStorage: localStorage.getItem('activeJobSetId')
            });
          } catch (e) {
            console.error('[Carousel] create-job-set exception:', e);
            toast.error('Erreur lors de la création du carrousel.');
            
            // Reset complet de l'état
            setActiveJobSetId('');
            setCarouselTotal(0);
            localStorage.removeItem('activeJobSetId');
            localStorage.removeItem('carouselTotal');
            
            return { error: 'Exception lors de la création' };
          }
          
          // ✅ NE MONTRER "génération en cours" QU'APRÈS SUCCÈS
          if (!jobSetId) {
            toast.error('Impossible de créer le carrousel.');
            return { error: 'Pas de jobSetId' };
          }
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🎨 Création d'un carrousel de ${count} slides en cours...\n\nCela va consommer ${count} visuels de ton quota.`
          }]);
          
          console.log('[Carousel] New jobSetId:', jobSetId);
          
          // ✅ Nettoyer l'ancien carrousel d'abord
          setActiveJobSetId('');
          setCarouselTotal(0);
          
          // ⏳ Puis après un court délai, charger le nouveau
          setTimeout(() => {
            setActiveJobSetId(jobSetId!);
            setCarouselTotal(count);
            localStorage.setItem('activeJobSetId', jobSetId!);
            localStorage.setItem('carouselTotal', count.toString());
            
            // ⚡ Forcer le refresh immédiat
            setTimeout(() => refreshCarousel(), 200);
          }, 100);
          
          await triggerWorker();
          pumpWorker(count);
          
          return {
            success: true,
            jobSetId: jobSetId,
            total: count,
            message: `Carrousel lancé ! Suivi en temps réel ci-dessous. ⏳`
          };
        } catch (error: any) {
          console.error('[create_carousel] Error:', error);
          toast.error(`Erreur carrousel: ${error.message}`);
          return { error: error.message || "Erreur création carrousel" };
        }
      }

      case 'classify_intent': {
        try {
          const msg = args.user_message?.toLowerCase() || '';
          
          let intent = 'other';
          if (/(^|\s)(image|visuel|cover|post visuel|illustration)(\s|$)/i.test(msg)) {
            intent = 'image';
          } else if (/(carrousel|carousel|slides|série)/i.test(msg)) {
            intent = 'carousel';
          } else if (/(vidéo|reel|short|story vidéo|video)/i.test(msg)) {
            intent = 'video';
          }
          
          console.log('[Intent] Detected:', intent, 'from:', msg);
          
          // 🔥 AUTO-TRIGGER: Si intent = carousel, déclencher automatiquement plan_carousel
          if (intent === 'carousel') {
            console.log('[Intent] Auto-triggering plan_carousel with prompt:', args.user_message);
            
            // Déclencher plan_carousel automatiquement (le message sera affiché dans le case)
            const planResult: any = await handleToolCall('plan_carousel', {
              prompt: args.user_message,
              count: 5
            });
            
            console.log('[Intent] plan_carousel result:', planResult);
            return { intent, auto_triggered: true, plan_result: planResult };
          }
          
          return { intent };
        } catch (error: any) {
          console.error('[Intent] Exception:', error);
          return { error: error.message || "Erreur de classification" };
        }
      }

      case 'plan_carousel': {
        try {
          // 🎨 Afficher un message de confirmation
          const confirmMsg: Message = {
            role: 'assistant',
            content: '🎨 Je prépare ton plan de carrousel...'
          };
          setMessages(prev => [...prev, confirmMsg]);
          
          if (conversationId) {
            await supabase.from('alfie_messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: confirmMsg.content
            });
          }

          const { prompt, count = 5 } = args;
          
          if (!activeBrandId) {
            return { error: "Aucune marque active. Crée d'abord un Brand Kit !" };
          }
          
          // Récupérer le Brand Kit
          const { data: brand } = await supabase
            .from('brands')
            .select('name, palette, voice')
            .eq('id', activeBrandId)
            .single();
          
          if (!brand) {
            return { error: "Brand Kit introuvable" };
          }
          
          // Appeler alfie-plan-carousel
          console.log('[Plan] Calling alfie-plan-carousel:', { prompt, count, brand: brand.name });
          
          const headers = await getAuthHeader();
          const { data, error } = await supabase.functions.invoke('alfie-plan-carousel', {
            body: { 
              prompt, 
              slideCount: count,
              brandKit: {
                name: brand.name,
                palette: brand.palette,
                voice: brand.voice
              }
            },
            headers
          });
          
          if (error || !data?.plan) {
            console.error('[Plan] alfie-plan-carousel failed:', error);
            return { error: 'Impossible de générer le plan. Réessaie.' };
          }
          
          // Stocker le plan en state pour utilisation ultérieure
          setCarouselPlan(data.plan);
          setCurrentSlideIndex(0);
          
          console.log('[Plan] ✅ Plan generated:', data.plan);
          
          // 🔥 Formater et afficher le plan immédiatement
          const formatPlanPreview = (plan: any): string => {
            const lines: string[] = [];
            
            // Résumé globals/promise
            if (plan?.globals?.promise) {
              lines.push(`🎯 **Objectif**: ${plan.globals.promise}`);
            }
            if (plan?.globals?.target) {
              lines.push(`👥 **Cible**: ${plan.globals.target}`);
            }
            
            lines.push('\n**📋 Plan des slides:**');
            
            // Liste des slides avec titre + 2 bullets max
            if (Array.isArray(plan?.slides)) {
              plan.slides.forEach((slide: any, i: number) => {
                lines.push(`\n**Slide ${i + 1}**: ${slide.title || '(sans titre)'}`);
                if (slide.subtitle) {
                  lines.push(`*${slide.subtitle}*`);
                }
                if (Array.isArray(slide.bullets) && slide.bullets.length > 0) {
                  slide.bullets.slice(0, 2).forEach((bullet: string) => {
                    lines.push(`  • ${bullet}`);
                  });
                }
              });
            }
            
            lines.push('\n✅ **Ça te va ?** Réponds **"oui"** pour lancer la génération en 4:5 !');
            
            return lines.join('\n');
          };
          
          const planPreview = formatPlanPreview(data.plan);
          
          // Afficher le plan dans le chat
          const planMessage: Message = {
            role: 'assistant',
            content: planPreview
          };
          setMessages(prev => [...prev, planMessage]);
          
          if (conversationId) {
            await supabase.from('alfie_messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: planPreview
            });
          }
          
          return { 
            success: true, 
            plan: data.plan,
            message: planPreview
          };
        } catch (error: any) {
          console.error('[Plan] Exception:', error);
          return { error: error.message || "Erreur de génération du plan" };
        }
      }

      case 'generate_carousel_slide': {
        try {
          const { slideIndex, slideContent } = args;
          const aspect_ratio = args.aspect_ratio || '1:1';
          
          // 1. Vérifier la marque active
          if (!activeBrandId) {
            return { error: "⚠️ Aucune marque active. Sélectionne d'abord une marque dans tes paramètres." };
          }
          
          if (!carouselPlan) {
            return { error: "Aucun plan de carrousel en cours. Crée d'abord un plan avec plan_carousel." };
          }
          
          // 2. Vérifier et consommer le quota AVANT de créer le job
          const quotaCheck = await checkAndConsumeQuota(supabase, 'visuals', 1, activeBrandId);
          if (!quotaCheck.ok) {
            return { error: quotaCheck.error };
          }
          
          // Créer un job_set pour cette slide unique (ou réutiliser un existant)
          let jobSetId = activeJobSetId;
          
          if (!jobSetId) {
            // Première slide : créer le job_set
            const headers = await getAuthHeader();
            const { data: jobSetData, error: jobSetError } = await supabase.functions.invoke('create-job-set', {
              body: { 
                brandId: activeBrandId, 
                prompt: carouselPlan.globals?.promise || "Carousel",
                count: carouselPlan.slides.length,
                aspectRatio: aspect_ratio
              },
              headers: {
                ...headers,
                'x-idempotency-key': crypto.randomUUID()
              }
            });
            
            // Flexible reading of job_set_id from response
            const jobSetPayload = jobSetData;
            const createdJobSetId = jobSetPayload?.data?.id ?? jobSetPayload?.id;
            
            if (jobSetError || !createdJobSetId) {
              console.error('[Slide] create-job-set failed:', jobSetError);
              // Recréditer le quota en cas d'échec
              await supabase.functions.invoke('alfie-refund-woofs', {
                body: { amount: 1, brand_id: activeBrandId },
                headers: await getAuthHeader()
              });
              return { error: 'Impossible de créer le carrousel' };
            }
            
            jobSetId = createdJobSetId;
            setActiveJobSetId(jobSetId);
            setCarouselTotal(carouselPlan.slides.length);
            localStorage.setItem('activeJobSetId', jobSetId);
            localStorage.setItem('carouselTotal', carouselPlan.slides.length.toString());
            
            console.log('[Slide] ✅ Job set created:', jobSetId);
          }
          
          // Créer le job pour cette slide spécifique
          const { data: brand } = await supabase
            .from('brands')
            .select('name, palette, voice, logo_url')
            .eq('id', activeBrandId)
            .single();
          
          const brandSnapshot = {
            name: brand?.name || '',
            palette: brand?.palette || [],
            voice: brand?.voice || '',
            logo_url: brand?.logo_url || null
          };
          
          const { error: jobError } = await supabase.from('jobs').insert({
            job_set_id: jobSetId,
            index_in_set: slideIndex,
            prompt: `Slide ${slideIndex + 1}: ${slideContent.title}`,
            brand_snapshot: brandSnapshot,
            metadata: { slideContent },
            status: 'queued'
          });
          
          if (jobError) {
            console.error('[Slide] Job insertion failed:', jobError);
            // Recréditer le quota en cas d'échec
            await supabase.functions.invoke('alfie-refund-woofs', {
              body: { amount: 1, brand_id: activeBrandId },
              headers: await getAuthHeader()
            });
            return { error: 'Impossible de créer la tâche de génération' };
          }
          
          console.log('[Slide] ✅ Job queued for slide', slideIndex);
          
          // Incrémenter l'index pour la prochaine slide
          setCurrentSlideIndex(slideIndex + 1);
          
          // Déclencher le worker
          await triggerWorker();
          
          return { 
            success: true, 
            message: `🎨 Génération de la Slide ${slideIndex + 1} lancée ! (en cours...)`
          };
        } catch (error: any) {
          console.error('[Slide] Exception:', error);
          return { error: error.message || "Erreur de génération de la slide" };
        }
      }
      
      default:
        return { error: "Tool not found" };
    }
  };

  // Heuristique locale pour détecter le format (si l'agent n'appelle pas l'outil)
  const detectAspectRatioFromText = (text: string): "1:1" | "4:5" | "9:16" | "16:9" => {
    const t = text.toLowerCase();
    if (/9\s*:\s*16|story|tiktok|reels|vertical/.test(t)) return "9:16";
    if (/4\s*:\s*5|portrait|feed/.test(t)) return "4:5";
    if (/16\s*:\s*9|youtube|horizontal|paysage/.test(t)) return "16:9";
    if (/1\s*:\s*1|carré|carre|square/.test(t)) return "1:1";
    if (/(carou?ss?el|carousel)/i.test(t)) return "4:5"; // Gère carrousel, carroussel, caroussel
    return "1:1";
  };

  const streamChat = async (userMessage: string) => {
    console.log('[Chat] Starting chat with alfie-chat edge function:', userMessage);
    
    try {
      setIsLoading(true);
      setIsAlfieThinking(true);
      
      // Add user message to conversation
      const userMsg = { 
        role: 'user' as const, 
        content: userMessage,
        ...(uploadedImage && { imageUrl: uploadedImage })
      };
      
      setMessages(prev => [...prev, userMsg]);
      
      // Persist user message
      if (conversationId) {
        await supabase.from('alfie_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: userMessage,
          ...(uploadedImage && { image_url: uploadedImage })
        });
      }
      
      // ⚡️ FALLBACK LOCAL : Validation "oui" pour carrousel
      const isValidation = /^(oui|go|vas[- ]?y|on y va|ok|let'?s go|yes)/i.test(userMessage);
      if (isValidation && carouselPlan && !activeJobSetId) {
        console.log('[Chat] User validation detected, auto-triggering create_carousel');
        
        await handleToolCall('create_carousel', {
          prompt: carouselPlan.globals?.promise || 'Carousel',
          count: carouselPlan.slides?.length || 5,
          aspect_ratio: '4:5'
        });
        
        return; // Ne pas continuer avec l'appel alfie-chat
      }

      // Call alfie-chat edge function
      const headers = await getAuthHeader();
      const { data: chatResponse, error: chatError } = await supabase.functions.invoke('alfie-chat', {
        body: {
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            ...(m.imageUrl && { imageUrl: m.imageUrl })
          })).concat([userMsg]),
          brandId: activeBrandId || brandKit?.id,
          stream: false
        },
        headers
      });

      if (chatError) {
        console.error('[Chat] alfie-chat error:', chatError);
        toast.error(chatError.message || "Erreur technique, réessaie !");
        return;
      }

      // Vérifier si la réponse indique une erreur métier
      if (chatResponse && !chatResponse.ok && chatResponse.error) {
        console.error('[Chat] alfie-chat business error:', chatResponse.error);
        toast.error(chatResponse.error);
        return;
      }

      // Parse response from alfie-chat
      const lastChoice = chatResponse?.choices?.[0];
      const assistantMessage = lastChoice?.message?.content || '';
      const toolCalls = lastChoice?.message?.tool_calls || [];

      console.log('[Chat] alfie-chat response:', { assistantMessage, toolCalls });

      // Add assistant message if present (only if no tool calls)
      if (assistantMessage && toolCalls.length === 0) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: assistantMessage 
        }]);
        
        // Persist assistant message
        if (conversationId) {
          await supabase.from('alfie_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantMessage
          });
        }
      }

      // Execute tool calls (sans message générique, chaque tool gère son propre message)

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function?.name;
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
        
        console.log('[Chat] Executing tool from alfie-chat:', toolName, toolArgs);
        
        try {
          const result = await handleToolCall(toolName, toolArgs);
          console.log('[Chat] Tool result:', result);
          
          // 🔥 Afficher AUSSI les messages de succès (pas que les erreurs)
          if (result?.success && result.message) {
            const successMessage: Message = {
              role: 'assistant',
              content: result.message
            };
            setMessages(prev => [...prev, successMessage]);
            
            if (conversationId) {
              await supabase.from('alfie_messages').insert({
                conversation_id: conversationId,
                role: 'assistant',
                content: result.message
              });
            }
          }
          
          // Afficher le résultat dans le chat si erreur
          if (result?.error) {
            const errorMessage: Message = {
              role: 'assistant',
              content: `❌ Erreur : ${result.error}`
            };
            setMessages(prev => [...prev, errorMessage]);
            
            if (conversationId) {
              await supabase.from('alfie_messages').insert({
                conversation_id: conversationId,
                role: 'assistant',
                content: errorMessage.content
              });
            }
          }
        } catch (err) {
          console.error('[Chat] Tool execution error:', toolName, err);
          const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue';
          toast.error(`Erreur lors de l'exécution de ${toolName}`);
          
          const errorMessage: Message = {
            role: 'assistant',
            content: `❌ Erreur technique lors de l'exécution de ${toolName}: ${errorMsg}`
          };
          setMessages(prev => [...prev, errorMessage]);
          
          if (conversationId) {
            await supabase.from('alfie_messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: errorMessage.content
            });
          }
        }
      }

      // Fallback: if image in context but no tool called, trigger image generation
      if (uploadedImage && toolCalls.length === 0 && !assistantMessage) {
        console.log('[Chat] Image in context but no tool called, triggering fallback generation');
        const aspectRatio = detectAspectRatioFromText(userMessage);
        try {
          const result = await handleToolCall('generate_image', {
            prompt: userMessage,
            aspect_ratio: aspectRatio
          });
          console.log('✅ Fallback image generation:', result);
        } catch (e) {
          console.error('❌ Fallback generation error:', e);
        }
      }

    } catch (error: any) {
      console.error('[Chat] alfie-chat error:', error);
      toast.error(error.message || "Erreur lors de la communication avec Alfie");
    } finally {
      setIsLoading(false);
      setIsAlfieThinking(false);
    }
  };

  // Déclencher le worker de traitement des jobs
  const triggerWorker = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        await supabase.functions.invoke('process-job-worker');
        return;
      }

      await supabase.functions.invoke('process-job-worker', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
    } catch (err) {
      // Silent fail - le worker sera retriggered au prochain poll
      console.log('[Worker] Trigger attempt:', err);
    }
  };

  // Pompe: relance périodiquement le worker jusqu'à complétion ou timeout
  const pumpWorker = (expectedTotal?: number, intervalMs = 2000, timeoutMs = 120000) => {
    if (pumpRef.current) {
      clearInterval(pumpRef.current);
      pumpRef.current = null;
    }
    pumpStartRef.current = Date.now();

    pumpRef.current = window.setInterval(async () => {
      const { done, total, jobSetId } = latestRef.current;
      const goal = expectedTotal ?? total;

      if (!jobSetId || goal <= 0) {
        return; // en attente d'initialisation
      }

      if (done >= goal) {
        if (pumpRef.current) {
          clearInterval(pumpRef.current);
          pumpRef.current = null;
        }
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.functions.invoke('process-job-worker', {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
        } else {
          await supabase.functions.invoke('process-job-worker');
        }
      } catch (e) {
        console.log('[Pump] worker error', e);
      }

      if (Date.now() - pumpStartRef.current > timeoutMs) {
        if (pumpRef.current) {
          clearInterval(pumpRef.current);
          pumpRef.current = null;
        }
        toast.warning('Toujours rien, tu peux relancer le traitement.');
      }
    }, intervalMs);
  };

  const handleCancelCarousel = async () => {
    if (!activeJobSetId) return;
    
    console.log('[CancelCarousel] Resetting job_set:', activeJobSetId);
    
    // FILET DE SÉCURITÉ: Fonction de nettoyage UI réutilisable
    const cleanupUI = () => {
      // Stop pumping
      if (pumpRef.current) {
        clearInterval(pumpRef.current);
        pumpRef.current = null;
      }
      
      // Clear ALL carousel state
      localStorage.removeItem('activeJobSetId');
      localStorage.removeItem('carouselTotal');
      setActiveJobSetId('');
      setCarouselTotal(0);
      
      // Refresh carousel to update UI (will clear items/done via hook)
      refreshCarousel();
    };
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('cancel-job-set', {
        body: { jobSetId: activeJobSetId },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      
      if (error) {
        console.warn('[CancelCarousel] Backend error (ignoring):', error);
      } else {
        console.log('[CancelCarousel] Backend success:', data);
      }
      
      // ✅ RÉINITIALISATION COMPLÈTE (même si le backend échoue)
      cleanupUI();
      toast.success('Carrousel réinitialisé, prêt à relancer ! 🔄');
      
    } catch (err: any) {
      console.error('[CancelCarousel] Exception:', err);
      // Nettoyer l'UI même en cas d'exception
      cleanupUI();
      toast.success('Carrousel réinitialisé localement ! 🔄');
    }
  };

  const clearChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Stop pumping if active
      if (pumpRef.current) {
        clearInterval(pumpRef.current);
        pumpRef.current = null;
      }
      
      // Clear local state
      setMessages([{ role: 'assistant', content: INITIAL_ASSISTANT_MESSAGE }]);
      setUploadedImage(null);
      setActiveJobSetId('');
      setCarouselTotal(0);
      localStorage.removeItem('activeJobSetId');
      localStorage.removeItem('carouselTotal');
      
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('alfie_conversations')
        .insert({ 
          user_id: user.id, 
          title: `Conversation ${new Date().toLocaleDateString('fr-FR')}` 
        })
        .select('id')
        .maybeSingle();
      
      if (convError || !newConv) {
        console.error('[ClearChat] Failed to create conversation:', convError);
        toast.error('Erreur lors du nettoyage');
        return;
      }
      
      // Insert initial message
      await supabase.from('alfie_messages').insert({
        conversation_id: newConv.id,
        role: 'assistant',
        content: INITIAL_ASSISTANT_MESSAGE
      });
      
      setConversationId(newConv.id);
      toast.success('Chat nettoyé ! 🧹');
    } catch (error: any) {
      console.error('[ClearChat] Error:', error);
      toast.error('Erreur lors du nettoyage');
    }
  };

  const handleSend = async (options?: { forceVideo?: boolean; forceImage?: boolean; aspectRatio?: string; skipMediaInference?: boolean }) => {
    if (!input.trim() || isLoading || !loaded) return;

    const forceVideo = options?.forceVideo ?? false;
    const forceImage = options?.forceImage ?? false;
    const selectedDuration = 'short'; // Default duration

    const userMessage = input.trim();
    const imageUrl = uploadedImage;
    setInput('');
    setUploadedImage(null);
    
    // S'assurer d'avoir une conversation
    let convId = conversationId;
    if (!convId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: created } = await supabase
        .from('alfie_conversations')
        .insert({ user_id: user.id, title: 'Conversation Alfie' })
        .select('id')
        .maybeSingle();
      if (created) {
        convId = created.id;
        setConversationId(created.id);
      }
    }
    
    // Add user message (UI)
    setMessages(prev => [...prev, { role: 'user', content: userMessage, imageUrl: imageUrl ?? undefined, created_at: new Date().toISOString() }]);

    // Persister le message utilisateur
    try {
      if (convId) {
        await supabase.from('alfie_messages').insert({
          conversation_id: convId,
          role: 'user',
          content: userMessage,
        });
        await supabase
          .from('alfie_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId);
      }
    } catch (e) {
      console.error('Persist user message error:', e);
    }

    // 1. Détection d'intent rapide (évite appel IA si possible)
    const intent = detectIntent(userMessage);
    console.log('🔍 Intent détecté:', intent);

    if (canHandleLocally(intent) && intent.type !== 'browse_templates') {
      // Gestion locale sans IA (économie)
      const localResponse = generateLocalResponse(intent);
      if (localResponse) {
        setMessages(prev => [...prev, { role: 'assistant', content: localResponse }]);
        
        // Exécuter l'action correspondante
        if (intent.type === 'show_brandkit') {
          const brandKitInfo = brandKit 
            ? `Voici ton Brand Kit 🎨\n\nCouleurs: ${brandKit.palette?.join(', ') || 'Aucune'}\nLogo: ${brandKit.logo_url ? 'Oui ✅' : 'Non ❌'}`
            : "Aucun Brand Kit configuré pour le moment 🐾";
          setMessages(prev => [...prev, { role: 'assistant', content: brandKitInfo }]);
        } else if (intent.type === 'check_credits') {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `Tu as ${totalCredits} crédits IA disponibles ✨\nRequêtes Alfie ce mois: ${requestsThisMonth}/${quota}` 
          }]);
        }
        return;
      }
    }

    // 2. Vérifier le quota mensuel
    // ⚠️ ANCIEN SYSTÈME DÉSACTIVÉ - On utilise get-quota (Woofs/Visuels) maintenant
    // Le blocage se fait via alfie-check-quota qui utilise get-quota
    // if (!checkQuota()) {
    //   setMessages(prev => [...prev, { 
    //     role: 'assistant', 
    //     content: `Oups ! Tu as atteint ton quota mensuel (${quota} requêtes/mois) 🐾\n\nPasse à un plan supérieur pour continuer à utiliser Alfie !` 
    //   }]);
    //   return;
    // }

    // 🎯 Le flux carrousel est désormais géré par alfie-chat via les tools plan_carousel et generate_carousel_slide
    // L'agent présente chaque slide en texte et attend validation avant de générer l'image

    if (forceImage) {
      const aspect = options?.aspectRatio || detectAspectRatioFromText(userMessage);
      await handleToolCall('generate_image', { prompt: userMessage, aspect_ratio: aspect });
      return;
    }

    if (forceVideo) {
      const aspect = detectAspectRatioFromText(userMessage);
      await handleToolCall('generate_video', {
        prompt: userMessage,
        aspectRatio: aspect,
        imageUrl,
        durationPreference: selectedDuration,
        woofCost: 2
      });
      return;
    }

    // ✅ Supprimer les raccourcis locaux : tout passe par streamChat pour que l'agent pose ses questions
    // Les boutons forceImage/forceVideo explicites (lignes 1731-1747) sont conservés

    // 3. Vérifier le cache pour les templates
    if (intent.type === 'browse_templates') {
      const cacheKey = `${intent.params?.category || 'general'}`;
      const cached = await getCachedResponse(cacheKey, 'browse_templates');
      
      if (cached) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: cached.message || 'Voici des templates que j\'ai trouvés ! ✨' 
        }]);
        toast.success('Réponse instantanée (cache) 🚀');
        return;
      }
    }

    // 4. Appel IA (avec incrémentation du compteur)
    setIsLoading(true);
    await incrementRequests();
    await streamChat(userMessage);
    setIsLoading(false);
  };

  const sendWithCurrentMode = () => {
    handleSend();
  };

  const isTextareaDisabled = isLoading || !loaded;

  // Logs de diagnostic
  console.log('[Carousel Debug]', {
    activeJobSetId,
    carouselTotal,
    carouselDone,
    itemsCount: carouselItems.length
  });

  const handleDownload = (url: string, type: 'image' | 'video') => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `alfie-${type}-${Date.now()}.${type === 'image' ? 'png' : 'mp4'}`;
    link.click();
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <CreateHeader onClearChat={clearChat} />
      <QuotaBar activeBrandId={activeBrandId} />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      
      {/* Messages area with dynamic bottom padding based on composer height */}
      <div 
        className="flex-1 overflow-y-auto" 
        style={{ paddingBottom: `${composerHeight + 8}px` }}
      >
        <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
          <section className="flex flex-col gap-4">
            {messages.map((message, index) => {
              if (message.jobId) {
                return (
                  <div key={`job-${message.jobId}-${index}`} className="flex justify-start animate-fade-in">
                    <JobPlaceholder
                      jobId={message.jobId}
                      shortId={message.jobShortId}
                      status={message.jobStatus || 'processing'}
                      progress={message.progress}
                      type={message.assetType === 'image' ? 'image' : 'video'}
                    />
                  </div>
                );
              }

              // Afficher AssetMessage pour les images/vidéos générées avec métadonnées complètes
              if (message.assetId && message.assetType && message.outputUrl && message.expiresAt) {
                return (
                  <div key={`asset-${message.assetId}-${index}`} className="flex justify-start animate-fade-in">
                    <AssetMessage
                      assetId={message.assetId}
                      type={message.assetType}
                      outputUrl={message.outputUrl}
                      expiresAt={message.expiresAt}
                      width={message.width}
                      height={message.height}
                      engine={message.engine}
                      woofsConsumed={message.woofsConsumed}
                      onOpenInLibrary={() => navigate('/library')}
                    />
                  </div>
                );
              }

              // Fallback pour anciens messages avec imageUrl uniquement
              if (message.imageUrl && !message.assetId) {
                return (
                  <div key={`legacy-${index}`} className="flex justify-start animate-fade-in">
                    <div className="max-w-md space-y-2">
                      <img 
                        src={message.imageUrl} 
                        alt="Generated content" 
                        className="rounded-lg shadow-lg w-full"
                      />
                      <p className="text-xs text-muted-foreground">Ancien format</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} className="animate-fade-in">
                  <ChatBubble
                    role={message.role}
                    content={message.content}
                    imageUrl={message.imageUrl}
                    videoUrl={message.videoUrl}
                    timestamp={message.created_at}
                    onDownloadImage={message.imageUrl ? () => handleDownload(message.imageUrl!, 'image') : undefined}
                    onDownloadVideo={message.videoUrl ? () => handleDownload(message.videoUrl!, 'video') : undefined}
                  />
                </div>
              );
            })}

            {(isLoading || isAlfieThinking || generationStatus) && (
              <div className="animate-fade-in">
                <ChatBubble
                  role="assistant"
                  content={generationStatus?.message || 'Alfie réfléchit à ta demande...'}
                  isStatus
                  generationType={generationStatus?.type === 'video' ? 'video' : generationStatus ? 'image' : 'text'}
                  isLoading={isLoading || isAlfieThinking && !generationStatus}
                />
              </div>
            )}

            {/* Carte de progression carrousel */}
            {activeJobSetId && carouselTotal > 0 && (
              <div className="animate-fade-in">
                <CarouselProgressCard
                  total={carouselTotal}
                  done={carouselDone}
                  items={carouselItems}
                  onDownloadZip={async () => {
                    try {
                      console.log('[Carousel] Downloading ZIP for job set:', activeJobSetId);
                      toast.loading('Préparation du ZIP...');
                      
                      const { data, error } = await supabase.functions.invoke('download-job-set-zip', {
                        body: { jobSetId: activeJobSetId }
                      });
                      
                      toast.dismiss();
                      
                      if (error) {
                        console.error('[Carousel] ZIP download error:', error);
                        throw error;
                      }
                      
                      // La fonction retourne maintenant une URL de storage
                      if (data?.url) {
                        console.log('[Carousel] Opening ZIP URL:', data.url);
                        window.open(data.url, '_blank');
                        toast.success('ZIP téléchargé ! 📦');
                        
                        // ✅ RÉINITIALISER l'état du carrousel après téléchargement
                        console.log('[Carousel] Resetting state after download');
                        setActiveJobSetId('');
                        setCarouselTotal(0);
                        localStorage.removeItem('activeJobSetId');
                        localStorage.removeItem('carouselTotal');
                      } else {
                        throw new Error('No ZIP URL returned');
                      }
                    } catch (err: any) {
                      console.error('[Carousel] ZIP download failed:', err);
                      toast.error(`Erreur lors du téléchargement: ${err.message || 'Erreur inconnue'}`);
                    }
                  }}
            onRetry={async () => {
              console.log('[Carousel] Manual retry triggered');
              
              // Réinitialiser les jobs bloqués en "running"
              const { error: resetErr } = await supabase
                .from('jobs')
                .update({ 
                  status: 'queued', 
                  started_at: null
                })
                .eq('job_set_id', activeJobSetId)
                .eq('status', 'running');
              
              if (resetErr) {
                console.error('[Carousel] Failed to reset stuck jobs:', resetErr);
                toast.error('Erreur lors de la réinitialisation des jobs bloqués');
                return;
              }
              
              console.log('[Carousel] Stuck jobs reset to queued');
              toast.success('Traitement relancé ! 🔄');
              
              // Relancer le worker et rafraîchir
              await triggerWorker();
              refreshCarousel();
              pumpWorker(carouselTotal);
            }}
            onCancel={handleCancelCarousel}
                />
              </div>
            )}

            {/* Scroll anchor */}
            <div id="chat-bottom" ref={messagesEndRef} />
          </section>
        </div>
      </div>

      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={sendWithCurrentMode}
        disabled={isTextareaDisabled}
        isLoading={isLoading}
        onUploadClick={() => fileInputRef.current?.click()}
        uploadingImage={uploadingImage}
        conversationId={conversationId ?? undefined}
        uploadedImage={uploadedImage}
        onRemoveImage={removeUploadedImage}
        onHeightChange={setComposerHeight}
        onQuickGenerate={() => {
          if (!activeBrandId) {
            toast.error("Sélectionne une marque d'abord ! 🐾");
            return;
          }
          const aspectRatio = detectAspectRatioFromText(input);
          console.log('[QuickGenerate] Triggering immediate image generation with aspect:', aspectRatio);
          handleToolCall('generate_image', {
            prompt: input,
            aspect_ratio: aspectRatio
          });
        }}
      />
    </div>
  );
}
