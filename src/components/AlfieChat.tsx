import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useAlfieCredits } from '@/hooks/useAlfieCredits';
import { useTemplateLibrary } from '@/hooks/useTemplateLibrary';
import { useAlfieOptimizations } from '@/hooks/useAlfieOptimizations';
import { useCarouselSubscription } from '@/hooks/useCarouselSubscription';
import { openInCanva } from '@/services/canvaLinker';
import { supabase } from '@/integrations/supabase/client';
import { detectIntent, canHandleLocally, generateLocalResponse } from '@/utils/alfieIntentDetector';
import { getQuotaStatus, formatExpirationMessage } from '@/utils/quotaManager';
import { JobPlaceholder, JobStatus } from '@/components/chat/JobPlaceholder';
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
}

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
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: INITIAL_ASSISTANT_MESSAGE
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{ type: string; message: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeJobSetId, setActiveJobSetId] = useState<string>('');
  const [carouselTotal, setCarouselTotal] = useState(0);
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
      // Nettoyer localStorage quand le carrousel est terminé
      localStorage.removeItem('activeJobSetId');
      localStorage.removeItem('carouselTotal');
      toast.success(`🎉 Carrousel terminé ! ${carouselTotal} slides générées`);
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
            .select('role, content, image_url, video_url, created_at')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });
          if (msgs && msgs.length > 0) {
            setMessages(msgs.map((m: any) => ({ 
              role: m.role, 
              content: m.content, 
              imageUrl: m.image_url,
              videoUrl: m.video_url,
              created_at: m.created_at 
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
        const { data } = await supabase
          .from('job_sets')
          .select('id, total, status')
          .eq('brand_id', activeBrandId)
          .in('status', ['queued', 'running', 'partial'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          console.log('[Carousel] Found active job_set:', data.id);
          setActiveJobSetId(data.id);
          setCarouselTotal(data.total || 0);
          localStorage.setItem('activeJobSetId', data.id);
          localStorage.setItem('carouselTotal', (data.total || 0).toString());
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
      try {
        await supabase.from('media_generations').insert({
          user_id: user.id,
          type: 'image',
          prompt: 'Upload source depuis le chat',
          output_url: publicUrl,
          is_source_upload: true,
          status: 'completed',
          brand_id: activeBrandId || null
        });
      } catch (e) {
        console.warn('Insertion source upload échouée (non bloquant):', e);
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

  const handleToolCall = async (toolName: string, args: any) => {
    console.log('Tool call:', toolName, args);
    
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
        openInCanva({
          templateUrl: args.template_url,
          generatedImageUrl: args.generated_image_url,
          brandKit: brandKit || undefined
        });
        return { success: true, message: "Canva ouvert dans un nouvel onglet" };
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
        try {
          setGenerationStatus({ type: 'image', message: 'Génération de ton image en cours... ✨' });

          const { data, error } = await supabase.functions.invoke('generate-ai-image', {
            body: {
              prompt: args.prompt,
              aspectRatio: args.aspect_ratio || '1:1'
            },
          });

          if (error) {
            console.error('Generate image error:', error);
            throw error;
          }

          if (!data?.imageUrl) {
            throw new Error("Aucune image générée");
          }
          
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          // Stocker en DB
          await supabase.from('media_generations').insert({
            user_id: user.id,
            type: 'image',
            prompt: args.prompt,
            output_url: data.imageUrl,
            status: 'completed',
            brand_id: activeBrandId || null
          });

          // Débiter les crédits SEULEMENT si l'image a été générée et stockée
          await decrementCredits(1, 'image_generation');
          await incrementGenerations();

          setGenerationStatus(null);
          
          const imageMessage = {
            role: 'assistant' as const,
            content: `Image générée avec succès ! (1 crédit utilisé) ✨`,
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
          console.error('Image generation error:', error);
          setGenerationStatus(null);
          toast.error("Erreur lors de la génération. Crédits non débités.");
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

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          await supabase.from('media_generations').insert({
            user_id: user.id,
            type: 'image',
            prompt: args.instructions,
            input_url: args.image_url,
            output_url: data.imageUrl,
            status: 'completed',
            brand_id: activeBrandId || null
          });

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
            }])
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
        // Adaptation Canva = GRATUIT, pas de quota consommé
        openInCanva({
          templateUrl: args.template_url || '',
          brandKit: brandKit || undefined
        });
        return { 
          success: true, 
          message: "Template ouvert dans Canva avec ton Brand Kit appliqué ! (Gratuit, pas comptabilisé) 🎨" 
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
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🎨 Création d'un carrousel de ${count} slides en cours...\n\nCela va consommer ${count} visuels de ton quota.`
          }]);
          
          const { data, error } = await supabase.functions.invoke('chat-create-carousel', {
            body: {
              brandId: activeBrandId,
              threadId: conversationId,
              prompt,
              count,
              aspectRatio: aspect_ratio
            },
            headers: {
              'x-idempotency-key': crypto.randomUUID()
            }
          });
          
          if (error) {
            console.error('[create_carousel] Error:', error);
            throw new Error(error.message || 'Erreur création carrousel');
          }
          
          if (!data?.jobSetId) {
            throw new Error('Aucun jobSetId retourné');
          }
          
          setActiveJobSetId(data.jobSetId);
          setCarouselTotal(count);
          
          await triggerWorker();
          pumpWorker(count);
          
          return {
            success: true,
            jobSetId: data.jobSetId,
            total: count,
            message: `Carrousel lancé ! Suivi en temps réel ci-dessous. ⏳`
          };
        } catch (error: any) {
          console.error('[create_carousel] Error:', error);
          toast.error(`Erreur carrousel: ${error.message}`);
          return { error: error.message || "Erreur création carrousel" };
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
    if (/carrousel|carousel/.test(t)) return "4:5";
    return "1:1";
  };

  const wantsImageFromText = (text: string): boolean => {
    return /(image|visuel|carrousel|carousel|affiche|flyer)/i.test(text);
  };

  const wantsVideoFromText = (t: string): boolean => {
    return /(vid[ée]o|video|reel|reels|tiktok|story|anime|animation|clip)/i.test(t);
  };

  const streamChat = async (userMessage: string) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alfie-chat`;
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage, imageUrl: uploadedImage }],
          brandId: brandKit?.id // Pass active brand ID
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Trop de requêtes, patiente un instant !");
          return;
        }
        if (response.status === 402) {
          toast.error("Crédit insuffisant.");
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let textBuffer = '';
      let toolCallsBuffer: Record<number, { name?: string; arguments: string }> = {};

      // Add empty assistant message that we'll update
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            
            // Handle tool calls - accumulate arguments incrementally
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const index = toolCall.index ?? 0;
                
                if (!toolCallsBuffer[index]) {
                  toolCallsBuffer[index] = { arguments: '' };
                }
                
                if (toolCall.function?.name) {
                  toolCallsBuffer[index].name = toolCall.function.name;
                }
                
                if (toolCall.function?.arguments) {
                  toolCallsBuffer[index].arguments += toolCall.function.arguments;
                }
              }
            }
            
            // Handle regular content
            const content = delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: assistantMessage
                };
                return newMessages;
              });
            }
          } catch (e) {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
      
      // Execute accumulated tool calls after stream completes
      console.log('🔧 Tool calls buffer:', toolCallsBuffer);
      for (const [, toolCall] of Object.entries(toolCallsBuffer)) {
        if (toolCall.name && toolCall.arguments) {
          try {
            const args = JSON.parse(toolCall.arguments);
            console.log('🔧 Executing tool:', toolCall.name, args);
            const result = await handleToolCall(toolCall.name, args);
            console.log('✅ Tool result:', result);
          } catch (e) {
            console.error('❌ Tool call execution error:', toolCall.name, e);
          }
        }
      }

      // Flush remaining buffer
      if (textBuffer.trim()) {
        const lines = textBuffer.split('\n');
        for (let line of lines) {
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: assistantMessage
                };
                return newMessages;
              });
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      // Persister le message assistant à la fin du stream
      try {
        if (assistantMessage.trim() && conversationId) {
          await supabase.from('alfie_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantMessage
          });
          await supabase
            .from('alfie_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }
      } catch (e) {
        console.error('Persist assistant message error:', e);
      }

    } catch (error) {
      console.error('Chat error:', error);
      toast.error("Oups, une erreur est survenue !");
      // Remove the empty assistant message if error
      setMessages(prev => prev.slice(0, -1));
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

    // 🎯 DÉTECTION CARROUSEL (prioritaire) - Avec Realtime via Hook
    const carouselMatch = userMessage.match(/carrousel|carousel/i);
    if (carouselMatch && !forceImage && !forceVideo) {
      const countMatch = userMessage.match(/\d+/);
      const slideCount = countMatch ? Math.min(10, Math.max(1, parseInt(countMatch[0]))) : 5;
      const wantsSquare = /(1x1|1:1|carr[ée])/i.test(userMessage);
      const aspect = wantsSquare ? '1:1' : '4:5';

      if (!activeBrandId) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Crée d'abord un Brand Kit pour générer des carrousels cohérents ! 🎨`
        }]);
        return;
      }

      try {
        setGenerationStatus({ type: 'image', message: `Planification du carrousel (${slideCount} slide${slideCount>1?'s':''})... 🎨` });

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Non authentifié');

        const idempotencyKey = crypto.randomUUID();

        // 1. Appeler la nouvelle edge function chat-create-carousel
        console.log('[Carousel] Calling chat-create-carousel...');
        const { data: jobSet, error } = await supabase.functions.invoke('chat-create-carousel', {
          body: {
            brandId: activeBrandId,
            prompt: userMessage,
            count: slideCount,
            aspectRatio: aspect
          },
          headers: {
            'x-idempotency-key': idempotencyKey,
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (error) throw error;
        if (!jobSet?.jobSetId) throw new Error('No jobSetId returned');

        console.log('[Carousel] Job set created:', jobSet.jobSetId);

        // 2. Afficher message de démarrage
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ Carrousel de ${slideCount} slides en cours de génération...`
        }]);

        // 3. Activer le hook en définissant jobSetId et total
        setActiveJobSetId(jobSet.jobSetId);
        setCarouselTotal(slideCount);
        
        // Persister dans localStorage pour restauration après refresh
        localStorage.setItem('activeJobSetId', jobSet.jobSetId);
        localStorage.setItem('carouselTotal', slideCount.toString());
        
        setGenerationStatus(null);

        // 4. Refresh immédiat pour charger les assets existants (si déjà générés)
        setTimeout(() => refreshCarousel(), 100);

        // 5. Déclencher le premier worker + pompe
        console.log('[Carousel] Triggering initial worker...');
        await triggerWorker();
        pumpWorker(slideCount);

        return;
      } catch (err: any) {
        console.error('[Carousel] Error:', err);
        toast.error(err.message || 'Erreur lors de la génération du carrousel');
        setGenerationStatus(null);
        setActiveJobSetId('');
        setCarouselTotal(0);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Erreur : ${err.message || 'Impossible de créer le carrousel'}`
        }]);
        return;
      }
    }

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

    if (!options?.skipMediaInference && wantsImageFromText(userMessage)) {
      const aspect = detectAspectRatioFromText(userMessage);
      await handleToolCall('generate_image', { prompt: userMessage, aspect_ratio: aspect });
      return;
    }

    if (!options?.skipMediaInference && wantsVideoFromText(userMessage)) {
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
    <div className="flex min-h-screen flex-col bg-background">
      <CreateHeader />
      <QuotaBar activeBrandId={activeBrandId} />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      
      {/* Messages area with bottom padding for fixed composer */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
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

            {(isLoading || generationStatus) && (
              <div className="animate-fade-in">
                <ChatBubble
                  role="assistant"
                  content={generationStatus?.message || 'Alfie réfléchit à ta demande...'}
                  isStatus
                  generationType={generationStatus?.type === 'video' ? 'video' : generationStatus ? 'image' : 'text'}
                  isLoading={isLoading && !generationStatus}
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
                      const { data, error } = await supabase.functions.invoke('download-job-set-zip', {
                        body: { jobSetId: activeJobSetId }
                      });
                      if (error) throw error;
                      if (data?.url) window.location.href = data.url;
                    } catch (err) {
                      toast.error('Erreur lors du téléchargement du ZIP');
                    }
                  }}
                  onRetry={async () => {
                    console.log('[Carousel] Manual retry triggered');
                    await triggerWorker();
                    refreshCarousel();
                    pumpWorker(carouselTotal);
                  }}
                />
              </div>
            )}

            {/* Scroll anchor */}
            <div id="chat-bottom" ref={messagesEndRef} />
          </section>
        </div>
      </div>
      
      {/* Fixed composer at bottom */}
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
      />
    </div>
  );
}
