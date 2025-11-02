import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Send, ImagePlus, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import { supabase } from '@/integrations/supabase/client';
import { getAuthHeader } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import TextareaAutosize from 'react-textarea-autosize';
import { CreateHeader } from '@/components/create/CreateHeader';
import { QuotaBar } from '@/components/create/QuotaBar';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image' | 'video' | 'carousel';
  assetUrl?: string;
  assetId?: string;
  metadata?: any;
  timestamp: Date;
}

type IntentType = 'image' | 'video' | 'carousel' | 'unknown';
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
    const remaining = type === 'visuals' ? quota.visuals_remaining : quota.woofs_remaining;

    if (remaining < amount) {
      return {
        ok: false,
        remaining,
        error: `Quota insuffisant. Il te reste ${remaining} ${type === 'visuals' ? 'visuels' : 'woofs'}.`
      };
    }

    // 2. Consommer le quota
    const consumeEndpoint = type === 'woofs' ? 'alfie-consume-woofs' : 'alfie-consume-visuals';
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

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function AlfieChat() {
  const { user } = useAuth();
  const { activeBrandId } = useBrandKit();
  
  // États
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: '👋 Salut ! Je suis Alfie, ton assistant créatif.\n\nJe peux générer :\n• **Images** (1 Woof)\n• **Vidéos** (1-3 Woofs)\n• **Carrousels** (1 Visuel/slide)\n\nQu\'est-ce qu\'on crée aujourd\'hui ?',
    type: 'text',
    timestamp: new Date()
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  // Carrousel tracking
  const [carouselPlan, setCarouselPlan] = useState<any>(null);
  const [originalCarouselPrompt, setOriginalCarouselPrompt] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{ type: string; message: string } | null>(null);
  const [composerHeight, setComposerHeight] = useState(192);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestRef = useRef<{ done: number; total: number; jobSetId: string }>({ done: 0, total: 0, jobSetId: '' });
  const pumpRef = useRef<number | null>(null);
  const pumpStartRef = useRef<number>(0);
  const [activeJobSetId, setActiveJobSetId] = useState<string>('');
  const [carouselTotal, setCarouselTotal] = useState(0);
  const [carouselDone, setCarouselDone] = useState(0);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ============================================================================
  // UTILITAIRES
  // ============================================================================
  
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date()
    }]);
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // ============================================================================
  // DÉTECTION D'INTENTION
  // ============================================================================
  
  const detectIntent = (prompt: string): IntentType => {
    const lower = prompt.toLowerCase();
    
    if (/(carrousel|carousel|slides|série)/i.test(lower)) {
      return 'carousel';
    }
    
    if (/(vidéo|video|reel|short|story)/i.test(lower)) {
      return 'video';
    }
    
    if (/(image|visuel|photo|illustration|cover)/i.test(lower)) {
      return 'image';
    }
    
    return 'unknown';
  };
  
  const extractCount = (prompt: string): number => {
    const match = prompt.match(/(\d+)\s*(slides?|visuels?|images?)/i);
    return match ? parseInt(match[1]) : 5;
  };
  
  const detectAspectRatio = (prompt: string): string => {
    if (/9:16|story|vertical|tiktok|reels/i.test(prompt)) return '9:16';
    if (/16:9|youtube|horizontal|paysage/i.test(prompt)) return '16:9';
    if (/4:5|instagram|carrousel/i.test(prompt)) return '4:5';
    if (/1:1|carré|square/i.test(prompt)) return '1:1';
    return '1:1';
  };
  
  // ============================================================================
  // GESTION DES QUOTAS
  // ============================================================================
  
  const checkAndConsumeQuota = async (
    type: 'woofs' | 'visuals',
    amount: number
  ): Promise<boolean> => {
    if (!activeBrandId) {
      toast.error('Aucune marque active. Sélectionne une marque d\'abord !');
      return false;
    }
    
    try {
      const headers = await getAuthHeader();
      
      // 1. Vérifier le quota
      const { data: quota, error: quotaError } = await supabase.functions.invoke('get-quota', {
        body: { brand_id: activeBrandId },
        headers
      });
      
      if (quotaError || !quota) {
        toast.error('Impossible de vérifier les quotas');
        return false;
      }
      
      const remaining = type === 'woofs' ? quota.woofs_remaining : quota.visuals_remaining;
      
      if (remaining < amount) {
        toast.error(`Quota insuffisant. Il te reste ${remaining} ${type}.`);
        addMessage({
          role: 'assistant',
          content: `❌ Quota insuffisant.\n\nIl te reste **${remaining} ${type}** mais tu en demandes **${amount}**.\n\nConsulte ton quota dans ton profil ou upgrade ton plan.`,
          type: 'text'
        });
        return false;
      }
      
      // 2. Consommer le quota
      const endpoint = type === 'woofs' ? 'alfie-consume-woofs' : 'alfie-consume-visuals';
      const { error: consumeError } = await supabase.functions.invoke(endpoint, {
        body: { 
          [type === 'woofs' ? 'cost_woofs' : 'cost_visuals']: amount,
          brand_id: activeBrandId 
        },
        headers
      });
      
      if (consumeError) {
        toast.error('Impossible de consommer le quota');
        return false;
      case 'generate_image': {
        const woofCost = 1;
        
        if (!activeBrandId) {
          return { error: "⚠️ Aucune marque active. Sélectionne d'abord une marque dans tes paramètres." };
        }

        const quotaCheck = await checkAndConsumeQuota(supabase, 'woofs', woofCost, activeBrandId);
        if (!quotaCheck.ok) {
          toast.error(quotaCheck.error);
          return { error: quotaCheck.error };
        }

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
              cost_woofs: woofCost
            },
          });

          if (error) {
            // Rembourser les Woofs en cas d'échec
            await supabase.functions.invoke('alfie-refund-woofs', {
              body: { amount: woofCost, brand_id: activeBrandId },
              headers: await getAuthHeader()
            });

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
        const woofCost = 1;
        
        if (!activeBrandId) {
          return { error: "⚠️ Aucune marque active. Sélectionne d'abord une marque dans tes paramètres." };
        }

        const quotaCheck = await checkAndConsumeQuota(supabase, 'woofs', woofCost, activeBrandId);
        if (!quotaCheck.ok) {
          toast.error(quotaCheck.error);
          return { error: quotaCheck.error };
        }

        try {
          setGenerationStatus({ type: 'image', message: 'Amélioration de ton image en cours... 🪄' });

          const { data, error } = await supabase.functions.invoke('improve-image', {
            body: { imageUrl: args.image_url, prompt: args.instructions },
          });

          if (error) {
            // Rembourser les Woofs en cas d'échec
            await supabase.functions.invoke('alfie-refund-woofs', {
              body: { amount: woofCost, brand_id: activeBrandId },
              headers: await getAuthHeader()
            });

            console.error('[Image] Improvement error:', error);
            throw error;
          }

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
        const woofCost = 2;
        
        if (!activeBrandId) {
          return { error: "⚠️ Aucune marque active. Sélectionne d'abord une marque dans tes paramètres." };
        }

        const quotaCheck = await checkAndConsumeQuota(supabase, 'woofs', woofCost, activeBrandId);
        if (!quotaCheck.ok) {
          toast.error(quotaCheck.error);
          return { error: quotaCheck.error };
        }

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
              woofCost: woofCost
            },
          });

          if (error) {
            // Rembourser les Woofs en cas d'échec
            await supabase.functions.invoke('alfie-refund-woofs', {
              body: { amount: woofCost, brand_id: activeBrandId },
              headers: await getAuthHeader()
            });
            throw new Error(error.message || 'Erreur backend');
          }
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
          
          if (error) {
            console.error('[Plan] Edge function error:', error);
            return { error: 'Impossible de générer le plan. Réessaie.' };
          }

          // Vérifier si le plan est vraiment invalide (pas de slides ou plan vide)
          if (!data?.plan?.slides || data.plan.slides.length === 0) {
            console.error('[Plan] Invalid or empty plan:', data);
            return { error: 'Le plan n\'a pas pu être généré. Réessaie avec plus de détails sur ton objectif.' };
          }
          
          // Si c'est un fallback mais qu'il contient des slides valides, continuer
          if (data?.fallback) {
            console.warn('[Plan] ⚠️ Using fallback plan, but continuing with valid slides');
          }
          
          // Stocker le plan en state pour utilisation ultérieure
          setCarouselPlan(data.plan);
          setOriginalCarouselPrompt(prompt); // Stocker le prompt original
          setCurrentSlideIndex(0);
          
          console.log('[Plan] ✅ Plan generated:', data.plan);
          
          // Convertir le plan au nouveau format si nécessaire
          const newFormatPlan: NewCarouselPlan = {
            globals: {
              aspect_ratio: '4:5',
              totalSlides: data.plan.slides?.length || 5,
              locale: 'fr-FR'
            },
            slides: data.plan.slides?.map((slide: any) => ({
              type: slide.type || 'solution',
              title: slide.title || '',
              subtitle: slide.subtitle || '',
              bullets: slide.bullets || [],
              cta: slide.cta_primary || slide.cta || ''
            })) || []
          };
          
          setCarouselPlan(newFormatPlan);
          setShowPlanEditor(true);
          
          // Message contextuel
          const editorMessage: Message = {
            role: 'assistant',
            content: '✅ Plan généré ! Tu peux maintenant **l\'éditer** avant de générer les visuels.'
          };
          setMessages(prev => [...prev, editorMessage]);
          
          return {
            success: true,
            plan: newFormatPlan,
            message: '✅ Plan généré ! Tu peux maintenant l\'éditer avant de générer les visuels.'
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
                prompt: originalCarouselPrompt || carouselPlan.globals?.promise || "Carousel",
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
      
      return true;
    } catch (error: any) {
      console.error('Quota check error:', error);
      toast.error('Erreur lors de la vérification des quotas');
      return false;
    }
  };
  
  const refundWoofs = async (amount: number) => {
    if (!activeBrandId) return;
    
    try {
      const headers = await getAuthHeader();
      await supabase.functions.invoke('alfie-refund-woofs', {
        body: { amount, brand_id: activeBrandId },
        headers
      });
    } catch (error) {
      console.error('Refund error:', error);
    }
  };
  
  // ============================================================================
  // GÉNÉRATION D'IMAGE
  // ============================================================================
  
  const generateImage = async (prompt: string, aspectRatio: string) => {
    console.log('[Image] Generating:', { prompt, aspectRatio });
    
    // 1. Vérifier et consommer quota
    const quotaOk = await checkAndConsumeQuota('woofs', 1);
    if (!quotaOk) return;
    
    // 2. Afficher message de génération
    addMessage({
      role: 'assistant',
      content: '🎨 Génération de ton image en cours...',
      type: 'text'
    });
    
    try {
      // 3. Mapper aspect ratio vers format
      const formatMap: Record<string, string> = {
        '1:1': '1024x1024',
        '4:5': '1024x1280',
        '9:16': '1024x1820',
        '16:9': '1820x1024'
      };
      const format = formatMap[aspectRatio] || '1024x1024';
      
      // 4. Appeler alfie-render-image
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
          prompt: originalCarouselPrompt || carouselPlan.globals?.promise || 'Carousel',
          count: carouselPlan.slides?.length || 5,
          aspect_ratio: '4:5'
        });
        
        return; // Ne pas continuer avec l'appel alfie-chat
      }

      // Call alfie-chat edge function
      const headers = await getAuthHeader();
      const { data, error } = await supabase.functions.invoke('alfie-render-image', {
        body: {
          provider: 'gemini-nano',
          prompt,
          format,
          brand_id: activeBrandId,
          cost_woofs: 1
        },
        headers
      });
      
      if (error) throw error;
      
      if (!data?.ok || !data?.data?.image_urls?.[0]) {
        throw new Error(data?.error || 'Aucune image générée');
      }
      
      // 5. Afficher l'image
      const imageUrl = data.data.image_urls[0];
      const generationId = data.data.generation_id;
      
      addMessage({
        role: 'assistant',
        content: '✨ Image générée avec succès !',
        type: 'image',
        assetUrl: imageUrl,
        assetId: generationId,
        metadata: { woofs: 1, aspectRatio }
      });
      
      toast.success('Image générée ! 🎨');
      
    } catch (error: any) {
      console.error('[Image] Error:', error);
      await refundWoofs(1);
      
      addMessage({
        role: 'assistant',
        content: `❌ Erreur de génération : ${error.message || 'Erreur inconnue'}`,
        type: 'text'
      });
      
      toast.error('Échec de la génération');
    }
  };
  
  // ============================================================================
  // GÉNÉRATION DE VIDÉO
  // ============================================================================
  
  const generateVideo = async (prompt: string, aspectRatio: string) => {
    console.log('[Video] Generating:', { prompt, aspectRatio });
    
    // Estimer le coût (simplifié : 2 Woofs par défaut)
    const woofCost = 2;
    
    // 1. Vérifier et consommer quota
    const quotaOk = await checkAndConsumeQuota('woofs', woofCost);
    if (!quotaOk) return;
    
    // 2. Afficher message de génération
    addMessage({
      role: 'assistant',
      content: `🎬 Génération de ta vidéo en cours (${woofCost} Woofs)...`,
      type: 'text'
    });
    
    try {
      // 3. Appeler generate-video
      const headers = await getAuthHeader();
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt,
          aspectRatio,
          imageUrl: uploadedImage,
          brandId: activeBrandId,
          woofCost
        },
        headers
      });
      
      if (error) throw error;
      
      // 4. Afficher le placeholder
      addMessage({
        role: 'assistant',
        content: '⏳ Vidéo en cours de traitement...\n\nCela peut prendre quelques minutes.',
        type: 'video',
        metadata: { jobId: data.jobId, status: 'processing', woofs: woofCost }
      });
      
      toast.success('Vidéo lancée ! Suivi en temps réel ci-dessus.');
      
      // Note: Le polling du statut devrait être géré par un hook ou subscription
      
    } catch (error: any) {
      console.error('[Video] Error:', error);
      await refundWoofs(woofCost);
      
      addMessage({
        role: 'assistant',
        content: `❌ Erreur de génération : ${error.message || 'Erreur inconnue'}`,
        type: 'text'
      });
      
      toast.error('Échec de la génération');
    }
  };
  
  // ============================================================================
  // GÉNÉRATION DE CARROUSEL
  // ============================================================================
  
  const generateCarousel = async (prompt: string, count: number, aspectRatio: string) => {
    console.log('[Carousel] Generating:', { prompt, count, aspectRatio });
    
    // 1. Vérifier et consommer quota
    const quotaOk = await checkAndConsumeQuota('visuals', count);
    if (!quotaOk) return;
    
    // 2. Afficher message de génération
    addMessage({
      role: 'assistant',
      content: `🎨 Génération d'un carrousel de ${count} slides en cours...`,
      type: 'text'
    });
    
    try {
      // 3. Appeler create-job-set
      const headers = await getAuthHeader();
      const { data, error } = await supabase.functions.invoke('create-job-set', {
        body: {
          brandId: activeBrandId,
          prompt,
          count,
          aspectRatio,
          ...(uploadedImage && { styleRef: uploadedImage })
        },
        headers: {
          ...headers,
          'x-idempotency-key': crypto.randomUUID()
        }
      });
      
      if (error) throw error;
      
      const jobSetId = data?.data?.id || data?.id;
      if (!jobSetId) throw new Error('Job set ID manquant');
      // Clear local state
      setMessages([{ role: 'assistant', content: INITIAL_ASSISTANT_MESSAGE }]);
      setUploadedImage(null);
      setActiveJobSetId('');
      setCarouselTotal(0);
      setOriginalCarouselPrompt(''); // Réinitialiser le prompt original
      localStorage.removeItem('activeJobSetId');
      localStorage.removeItem('carouselTotal');
      
      // 4. Tracker le job set
      setActiveJobSetId(jobSetId);
      setCarouselTotal(count);
      localStorage.setItem('activeJobSetId', jobSetId);
      localStorage.setItem('carouselTotal', count.toString());
      
      // 5. Déclencher le worker
      await supabase.functions.invoke('process-job-worker', { headers });
      
      // 6. Afficher le suivi
      addMessage({
        role: 'assistant',
        content: `⏳ Carrousel en cours...\n\n0/${count} slides générées`,
        type: 'carousel',
        metadata: { jobSetId, total: count, done: 0 }
      });
      
      toast.success(`Carrousel de ${count} slides lancé !`);
      
      // Note: Le suivi en temps réel devrait être géré par useCarouselSubscription
      
    } catch (error: any) {
      console.error('[Carousel] Error:', error);
      // Refund des visuels (à implémenter si nécessaire)
      
      addMessage({
        role: 'assistant',
        content: `❌ Erreur de génération : ${error.message || 'Erreur inconnue'}`,
        type: 'text'
      });
      
      toast.error('Échec de la génération');
    }
  };
  
  // ============================================================================
  // GESTION DE L'ENVOI
  // ============================================================================
  
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (!activeBrandId) {
      toast.error('Sélectionne une marque d\'abord !');
      return;
    }
    
    const userPrompt = input.trim();
    setInput('');
    setIsLoading(true);
    
    // 1. Ajouter le message utilisateur
    addMessage({
      role: 'user',
      content: userPrompt,
      type: 'text'
    });
    
    try {
      // 2. Détecter l'intention
      const intent = detectIntent(userPrompt);
      console.log('[Intent] Detected:', intent);
      
      // 3. Router vers la bonne fonction
      switch (intent) {
        case 'image': {
          const aspectRatio = detectAspectRatio(userPrompt);
          await generateImage(userPrompt, aspectRatio);
          break;
        }
        
        case 'video': {
          const aspectRatio = detectAspectRatio(userPrompt);
          await generateVideo(userPrompt, aspectRatio);
          break;
        }
        
        case 'carousel': {
          const count = extractCount(userPrompt);
          const aspectRatio = detectAspectRatio(userPrompt);
          await generateCarousel(userPrompt, count, aspectRatio);
          break;
        }
        
        case 'unknown':
        default: {
          addMessage({
            role: 'assistant',
            content: '🤔 Je n\'ai pas compris ta demande.\n\nPrécise si tu veux :\n• Une **image**\n• Une **vidéo**\n• Un **carrousel**',
            type: 'text'
          });
          break;
        }
      }
      
    } catch (error: any) {
      console.error('[Send] Error:', error);
      toast.error('Erreur lors du traitement');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ============================================================================
  // GESTION DE L'UPLOAD D'IMAGE
  // ============================================================================
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 5MB)');
      return;
    }
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('chat-uploads')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(fileName);
      
      setUploadedImage(publicUrl);
      toast.success('Image ajoutée ! 📸');
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erreur lors de l\'upload');
    }
  };
  
  const removeUploadedImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // ============================================================================
  // NETTOYAGE DU CHAT
  // ============================================================================
  
  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '👋 Salut ! Je suis Alfie, ton assistant créatif.\n\nJe peux générer :\n• **Images** (1 Woof)\n• **Vidéos** (1-3 Woofs)\n• **Carrousels** (1 Visuel/slide)\n\nQu\'est-ce qu\'on crée aujourd\'hui ?',
      type: 'text',
      timestamp: new Date()
    }]);
    setUploadedImage(null);
    setActiveJobSetId('');
    setCarouselTotal(0);
    setCarouselDone(0);
    localStorage.removeItem('activeJobSetId');
    localStorage.removeItem('carouselTotal');
    toast.success('Chat nettoyé ! 🧹');
  };
  
  // ============================================================================
  // RENDU
  // ============================================================================
  
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
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} gap-3 animate-fade-in`}
            >
              {/* Avatar Alfie */}
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md">
                    <span className="text-white text-sm font-bold">🐾</span>
                  </div>
                </div>
              )}
              
              {/* Bulle */}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-sm'
                }`}
              >
                {/* Contenu texte */}
                {message.type === 'text' && (
                  <div className={`prose prose-sm max-w-none leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user' ? 'prose-invert' : 'dark:prose-invert'
                  }`}>
                    {message.content}
                  </div>
                )}
                
                {/* Contenu image */}
                {message.type === 'image' && message.assetUrl && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{message.content}</p>
                    <img
                      src={message.assetUrl}
                      alt="Generated"
                      className="rounded-lg w-full shadow-lg"
                    />
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>💎 {message.metadata?.woofs || 1} Woof</span>
                      <span>📐 {message.metadata?.aspectRatio || '1:1'}</span>
                    </div>
                  </div>
                )}
                
                {/* Contenu vidéo */}
                {message.type === 'video' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{message.content}</p>
                    <div className="text-xs text-muted-foreground">
                      Job ID: {message.metadata?.jobId}
                    </div>
                  </div>
                )}
                
                {/* Contenu carrousel */}
                {message.type === 'carousel' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{message.content}</p>
                    <div className="text-xs text-muted-foreground">
                      Job Set ID: {message.metadata?.jobSetId}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Avatar User */}
              {message.role === 'user' && (
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center shadow-md">
                    <span className="text-white text-sm font-semibold">
                      {user?.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                );
              }

              // Messages texte normaux (user et assistant)
              return (
                <div 
                  key={`msg-${index}`} 
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in gap-3`}
                >
                  {/* Avatar Alfie (assistant seulement) */}
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md">
                        <span className="text-white text-sm font-bold">🐾</span>
                      </div>
                    </div>
                  )}
                  
                  <div 
                    className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md ${
                      message.role === 'user' 
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm' 
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-tl-sm'
                    }`}
                  >
                    <div className={`prose prose-sm max-w-none leading-relaxed ${
                      message.role === 'user' 
                        ? 'prose-invert' 
                        : 'dark:prose-invert'
                    }`}>
                      {message.content}
                    </div>
                  </div>
                  
                  {/* Avatar User (utilisateur seulement) */}
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center shadow-md">
                        <span className="text-white text-sm font-semibold">{user?.email?.[0]?.toUpperCase() || 'U'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Composer */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-background via-background/98 to-background/95 backdrop-blur-xl border-t border-border/50 shadow-2xl pt-4 px-4 pb-4 z-10">
        <div className="max-w-4xl mx-auto space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <TextareaAutosize
                minRows={1}
                maxRows={5}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Décris ton idée à Alfie… (Shift+Entrée = nouvelle ligne)"
                disabled={isLoading}
                className="w-full resize-none bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 pr-32 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm transition-all duration-200 hover:shadow-md"
              />
              
              <div className="absolute right-2 bottom-2 flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <ImagePlus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </Button>
              </div>
            </div>
            
            <Button
              type="button"
              size="icon"
              className="h-12 w-12 shrink-0 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl"
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <Sparkles className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Send className="h-5 w-5 text-white" />
              )}
            </Button>
          </div>
          
          {/* Quick chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <Button
              variant="outline"
              size="sm"
              className="text-xs shrink-0 rounded-xl border-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 shadow-sm"
              onClick={() => setInput('Crée-moi une image 1:1')}
              disabled={isLoading}
            >
              Image 1:1
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs shrink-0 rounded-xl border-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 shadow-sm"
              onClick={() => setInput('Crée-moi une vidéo 9:16')}
              disabled={isLoading}
            >
              Vidéo 9:16
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs shrink-0 rounded-xl border-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200 shadow-sm"
              onClick={() => setInput('Crée-moi un carrousel de 5 slides')}
              disabled={isLoading}
            >
              Carrousel 5 slides
            </Button>
          </div>
          
          {/* Image uploadée */}
          {uploadedImage && (
            <div className="relative inline-block">
              <img
                src={uploadedImage}
                alt="Aperçu"
                className="h-20 w-20 rounded-lg object-cover border shadow-sm"
              />
              <button
                onClick={removeUploadedImage}
                className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold shadow-md hover:bg-red-600 transition-colors"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
