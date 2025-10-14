import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useAlfieCredits } from '@/hooks/useAlfieCredits';
import { useTemplateLibrary } from '@/hooks/useTemplateLibrary';
import { useAlfieOptimizations } from '@/hooks/useAlfieOptimizations';
import { openInCanva } from '@/services/canvaLinker';
import { supabase } from '@/integrations/supabase/client';
import { detectIntent, canHandleLocally, generateLocalResponse } from '@/utils/alfieIntentDetector';
import { getQuotaStatus, consumeQuota, canGenerateVideo, checkQuotaAlert, formatExpirationMessage } from '@/utils/quotaManager';
import { routeVideoEngine, estimateVideoDuration, detectVideoStyle } from '@/utils/videoRouting';
import { JobPlaceholder, JobStatus } from '@/components/chat/JobPlaceholder';
import { ChatMessage } from '@/components/create/ChatMessage';
import { Toolbar, type CreateMode, type CreateRatio } from '@/components/create/Toolbar';
import { ChatInput } from '@/components/create/ChatInput';
import { SidebarSession, type FavoriteItem } from '@/components/create/SidebarSession';
import { type MediaType } from '@/components/create/MediaCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  created_at?: string;
  jobId?: string;
  jobStatus?: JobStatus;
  progress?: number;
  assetId?: string;
  assetType?: 'image' | 'video';
}

interface AlfieChatProps {
  isSidebarOpen: boolean;
}

const STORAGE_KEYS = {
  messages: 'alfie.creer.messages',
  history: 'alfie.creer.history',
  favorites: 'alfie.creer.favorites',
  mode: 'alfie.creer.mode',
  ratio: 'alfie.creer.ratio',
};

const SUGGESTIONS = [
  'Portrait stylisé pour un lancement de produit',
  'Story 9:16 pour annoncer une offre flash',
  'Packshot produit ambiance studio',
  'Script d’annonce vidéo 30s ton dynamique',
];

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

export function AlfieChat({ isSidebarOpen }: AlfieChatProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEYS.messages);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Message[];
          if (parsed.length > 0) {
            return parsed;
          }
        } catch (error) {
          console.warn('Invalid stored messages', error);
        }
      }
    }
    return [
      {
        role: 'assistant',
        content: INITIAL_ASSISTANT_MESSAGE,
      },
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{ type: string; message: string } | null>(null);
  const [mode, setMode] = useState<CreateMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEYS.mode) as CreateMode | null;
      if (stored) {
        return stored;
      }
    }
    return 'auto';
  });
  const [ratio, setRatio] = useState<CreateRatio | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEYS.ratio) as CreateRatio | null;
      if (stored) {
        return stored;
      }
    }
    return null;
  });
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEYS.history);
      if (stored) {
        try {
          return JSON.parse(stored) as string[];
        } catch (error) {
          console.warn('Invalid history storage', error);
        }
      }
    }
    return [];
  });
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEYS.favorites);
      if (stored) {
        try {
          return JSON.parse(stored) as FavoriteItem[];
        } catch (error) {
          console.warn('Invalid favorites storage', error);
        }
      }
    }
    return [];
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { brandKit, activeBrandId } = useBrandKit();
  const { totalCredits, decrementCredits, hasCredits, incrementGenerations } = useAlfieCredits();
  const { searchTemplates } = useTemplateLibrary();
  const {
    checkQuota, 
    getCachedResponse, 
    setCachedResponse, 
    incrementRequests,
    requestsThisMonth,
    quota,
    quotaPercentage
  } = useAlfieOptimizations();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.mode, mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (ratio) {
      window.localStorage.setItem(STORAGE_KEYS.ratio, ratio);
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.ratio);
    }
  }, [ratio]);

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

  // Scroll automatique avec scrollIntoView
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generationStatus]);

  const lastImageMessage = useMemo(() => {
    return [...messages].reverse().find(message => Boolean(message.imageUrl));
  }, [messages]);

  const showRatioOptions = mode === 'image' || Boolean(lastImageMessage?.imageUrl);

  const favoriteUrls = useMemo(() => new Set(favorites.map((fav) => fav.url)), [favorites]);

  const hasUserMessages = useMemo(() => messages.some((message) => message.role === 'user'), [messages]);

  const toggleFavorite = (url: string, type: MediaType, caption?: string) => {
    setFavorites((prev) => {
      const exists = prev.some((item) => item.url === url);
      if (exists) {
        return prev.filter((item) => item.url !== url);
      }

      const newFavorite: FavoriteItem = {
        id: url,
        url,
        type: type === 'text' ? 'image' : type,
        caption,
        createdAt: new Date().toISOString(),
      };

      return [newFavorite, ...prev].slice(0, 24);
    });
  };

  const removeFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((item) => item.id !== id));
  };

  const handleModeChange = (nextMode: CreateMode) => {
    setMode(nextMode);
    if (nextMode !== 'image') {
      setRatio(null);
    }
  };

  const handleRatioChange = (nextRatio: CreateRatio) => {
    setRatio((prev) => (prev === nextRatio ? null : nextRatio));
  };

  const handleDownloadMedia = (url: string, type: MediaType) => {
    const extension = type === 'video' ? 'mp4' : 'png';
    const link = document.createElement('a');
    link.href = url;
    link.download = `alfie-${type}-${Date.now()}.${extension}`;
    link.rel = 'noopener';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPlan = async (plan: string) => {
    try {
      await navigator.clipboard.writeText(plan);
      toast.success('Plan copié dans le presse-papiers ✨');
    } catch (error) {
      console.error('Copy error', error);
      toast.error('Impossible de copier le plan');
    }
  };

  const handleHistorySelect = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const handleVariants = () => {
    toast.info('Variantes bientôt disponibles ✨');
  };

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

      const { data, error } = await supabase.storage
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

      toast.success('Image ajoutée ! 📸');
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
            }
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
            }
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
            status: 'completed'
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
            body: { imageUrl: args.image_url, prompt: args.instructions }
          });

          if (error) throw error;

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          await supabase.from('media_generations').insert({
            user_id: user.id,
            type: 'improved_image',
            prompt: args.instructions,
            input_url: args.image_url,
            output_url: data.imageUrl,
            status: 'completed'
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
          
          // Décrémenter les Woofs (coût unifié = 1 Woof)
          const { data: profile } = await supabase
            .from('profiles')
            .select('woofs_consumed_this_month')
            .eq('id', user.id)
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({ woofs_consumed_this_month: (profile.woofs_consumed_this_month || 0) + 1 })
              .eq('id', user.id);
          }
          
          // Appeler l'edge function avec fallback automatique
          const { data, error } = await supabase.functions.invoke('generate-video', {
            body: {
              prompt: args.prompt,
              aspectRatio: args.aspectRatio || '16:9',
              imageUrl: args.imageUrl
            }
          });
          
          if (error) {
            console.error('Edge function error:', error);
            throw new Error(error.message || 'Erreur backend');
          }

          if (data?.error) {
            console.error('Provider error:', data.error);
            throw new Error(data.error);
          }
          
          const { id, provider } = data;
          console.log(`✅ [generate_video] Started with provider: ${provider}, ID: ${id}`);
          
          // Créer l'asset dans la DB
          const { data: asset, error: assetError } = await supabase
            .from('media_generations')
            .insert({
              user_id: user.id,
              brand_id: activeBrandId,
              type: 'video',
              engine: provider,
              status: 'processing',
              prompt: args.prompt,
              woofs: 1,
              output_url: '', // sera mis à jour quand prêt
              metadata: { predictionId: id, provider }
            })
            .select()
            .single();
          
          if (assetError) throw assetError;
          
          // Message de confirmation
          const providerName = provider === 'sora' ? 'Sora2' : provider === 'seededance' ? 'Seededance' : 'Kling';
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🎬 Génération vidéo lancée avec ${providerName} ! (1 Woof)\n\nJe te tiens au courant dès que c'est prêt.`,
            jobId: asset.id,
            jobStatus: 'processing' as JobStatus
          }]);
          
          return { success: true, assetId: asset.id, provider };
          
        } catch (error: any) {
          console.error('[generate_video] Error:', error);
          const errorMessage = error?.message || "Erreur inconnue";
          toast.error(`Échec génération vidéo: ${errorMessage}`);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `❌ Erreur vidéo: ${errorMessage}\n\nVérifie les logs et les secrets backend (KIE_AI_API_KEY, REPLICATE_API_TOKEN).`
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
      
      default:
        return { error: "Tool not found" };
    }
  };

  // Heuristique locale pour détecter le format (si l'agent n'appelle pas l'outil)
  const detectAspectRatioFromText = (text: string): '1:1' | '4:5' | '9:16' | '16:9' => {
    if (ratio) {
      return ratio;
    }
    const t = text.toLowerCase();
    if (/9\s*:\s*16|story|tiktok|reels|vertical/.test(t)) return '9:16';
    if (/4\s*:\s*5|portrait|feed/.test(t)) return '4:5';
    if (/16\s*:\s*9|youtube|horizontal|paysage/.test(t)) return '16:9';
    if (/1\s*:\s*1|carré|carre|square/.test(t)) return '1:1';
    if (/carrousel|carousel/.test(t)) return '4:5';
    return '1:1';
  };

  const wantsImageFromText = (text: string): boolean => {
    if (mode === 'image') return true;
    if (mode === 'text') return false;
    return /(image|visuel|carrousel|carousel|affiche|flyer)/i.test(text);
  };

  const wantsVideoFromText = (text: string): boolean => {
    if (mode === 'video') return true;
    if (mode === 'text') return false;
    return /(vid[ée]o|reel|reels|tiktok|story|anime|animation|clip)/i.test(text);
  };

  const streamChat = async (userMessage: string) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alfie-chat`;
    
    try {
      const payload: Record<string, unknown> = {
        messages: [...messages, { role: 'user', content: userMessage, imageUrl: uploadedImage }],
        brandId: brandKit?.id,
      };

      if (mode !== 'auto') {
        payload.mode = mode;
      }

      if (ratio) {
        payload.ratio = ratio;
      }

      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(payload),
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
            
            // Handle tool calls
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (toolCall.function?.name && toolCall.function?.arguments) {
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const result = await handleToolCall(toolCall.function.name, args);
                    console.log('Tool result:', result);
                  } catch (e) {
                    console.error('Tool call error:', e);
                  }
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

  const handleSend = async () => {
    if (!input.trim() || isLoading || !loaded) return;

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
    setMessages(prev => [...prev, { role: 'user', content: userMessage, imageUrl, created_at: new Date().toISOString() }]);

    setHistory((prev) => {
      const trimmed = userMessage.slice(0, 180);
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)];
      return next.slice(0, 20);
    });

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
    if (!checkQuota()) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Oups ! Tu as atteint ton quota mensuel (${quota} requêtes/mois) 🐾\n\nPasse à un plan supérieur pour continuer à utiliser Alfie !` 
      }]);
      return;
    }

    // 2.5 Fallback local: si l'utilisateur demande clairement une image, lance la génération directe
    if (wantsImageFromText(userMessage)) {
      const aspect = detectAspectRatioFromText(userMessage);
      await handleToolCall('generate_image', { prompt: userMessage, aspect_ratio: aspect });
      return;
    }

    // 2.6 Fallback local: si l'utilisateur demande clairement une vidéo, lance la génération directe
    if (wantsVideoFromText(userMessage)) {
      const aspect = detectAspectRatioFromText(userMessage);
      await handleToolCall('generate_video', { prompt: userMessage, aspectRatio: aspect, imageUrl });
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full w-full justify-center">
      <div className="flex w-full max-w-[1200px] flex-1 flex-col gap-6 pb-8">
        <div className="flex flex-1 flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-md">
              <ScrollArea className="h-full px-6 py-6" ref={scrollRef}>
                <div className="flex flex-col gap-6">
                  {!hasUserMessages && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 shadow-inner">
                      <p className="mb-4 text-base font-semibold text-slate-700">Commence avec une suggestion</p>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => handleHistorySelect(suggestion)}
                            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-md transition hover:bg-blue-50 hover:text-blue-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    message.jobId ? (
                      <div key={`${message.jobId}-${index}`} className="flex justify-start">
                        <JobPlaceholder
                          jobId={message.jobId}
                          shortId={message.jobId.slice(-6).toUpperCase()}
                          status={message.jobStatus || 'running'}
                          progress={message.progress}
                          type={message.assetType === 'image' ? 'image' : 'video'}
                        />
                      </div>
                    ) : (
                      <ChatMessage
                        key={`${message.role}-${index}-${message.created_at ?? index}`}
                        message={message}
                        isFavorite={message.imageUrl ? favoriteUrls.has(message.imageUrl) : message.videoUrl ? favoriteUrls.has(message.videoUrl) : false}
                        onToggleFavorite={(url, type, caption) => toggleFavorite(url, type, caption)}
                        onDownload={(url, type) => handleDownloadMedia(url, type)}
                        onVariants={() => handleVariants()}
                        onCopyPlan={handleCopyPlan}
                      />
                    )
                  ))}

                  {(isLoading || generationStatus) && (
                    <div className="flex justify-start">
                      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-700 shadow-md">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-inner">
                          <Sparkles className="h-5 w-5 animate-spin text-blue-600" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-blue-700">
                            {generationStatus
                              ? generationStatus.type === 'video'
                                ? 'Génération vidéo en cours…'
                                : 'Génération image en cours…'
                              : 'Alfie prépare sa réponse…'}
                          </p>
                          {generationStatus?.message && (
                            <p className="text-xs text-blue-700/80">{generationStatus.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </div>

            <div className="sticky bottom-4 z-20 space-y-4 bg-gradient-to-t from-slate-50 via-slate-50/70 to-transparent pb-4">
              <Toolbar
                mode={mode}
                onModeChange={handleModeChange}
                ratio={ratio}
                onRatioChange={handleRatioChange}
                showRatioOptions={showRatioOptions}
              />

              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <ChatInput
                  ref={inputRef}
                  value={input}
                  onChange={setInput}
                  onSend={handleSend}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading || uploadingImage}
                  onAttachmentClick={() => fileInputRef.current?.click()}
                  uploadedImage={uploadedImage}
                  onRemoveImage={() => setUploadedImage(null)}
                />
                {uploadingImage && (
                  <p className="text-xs text-slate-500">Téléversement en cours…</p>
                )}
              </div>
            </div>
          </div>

          <SidebarSession
            history={history}
            onHistorySelect={handleHistorySelect}
            favorites={favorites}
            onRemoveFavorite={removeFavorite}
            isOpen={isSidebarOpen}
          />
        </div>
      </div>
    </div>
  );
}
