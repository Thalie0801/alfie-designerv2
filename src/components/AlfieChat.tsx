import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Send, ImagePlus, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBrandKit } from '@/hooks/useBrandKit';
import { supabase } from '@/integrations/supabase/client';
import { getAuthHeader } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import TextareaAutosize from 'react-textarea-autosize';
import { CreateHeader } from '@/components/create/CreateHeader';
import { QuotaBar } from '@/components/create/QuotaBar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

// ======
// TYPES
// ======

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image' | 'video' | 'carousel' | 'reasoning';
  assetUrl?: string;
  assetId?: string;
  metadata?: any;
  reasoning?: string; // ✅ Nouveau : explications de l'agent
  brandAlignment?: string; // ✅ Nouveau : comment ça respecte le Brand Kit
  timestamp: Date;
}

type IntentType = 'image' | 'video' | 'carousel' | 'unknown';

// ======
// COMPOSANT PRINCIPAL
// ======

export function AlfieChat() {
  const { user } = useAuth();
  const { activeBrandId, brandKit } = useBrandKit();
  
  // États minimaux
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: '👋 Hey ! Je suis Alfie, ton assistant créatif.\n\nJe peux créer pour toi :\n• Des **images** percutantes\n• Des **vidéos** engageantes\n• Des **carrousels** complets\n\nQu\'est-ce que tu veux créer aujourd\'hui ?',
    type: 'text',
    timestamp: new Date()
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [carouselProgress, setCarouselProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPollingRef = useRef<Record<string, NodeJS.Timeout>>({});
  const carouselChannelRef = useRef<any>(null);
  
  // ======
  // UTILITAIRES
  // ======
  
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>): string => {
    const id = crypto.randomUUID();
    setMessages(prev => [...prev, {
      ...message,
      id,
      timestamp: new Date()
    }]);
    return id;
  };
  
  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // ======
  // DÉTECTION D'INTENTION LOCALE
  // ======
  
  const detectIntent = (prompt: string): IntentType => {
    const lower = prompt.toLowerCase();
    
    // Priorité 1 : Carrousel
    if (/(carrousel|carousel|slides|série)/i.test(lower)) {
      return 'carousel';
    }
    
    // Priorité 2 : Vidéo
    if (/(vidéo|video|reel|short|story)/i.test(lower)) {
      return 'video';
    }
    
    // Priorité 3 : Image
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
  
  // ======
  // GESTION DES QUOTAS
  // ======
  
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
      
      // 2. Consommer le quota (seulement pour visuals, pas pour woofs)
      if (type === 'visuals') {
        const { error: consumeError } = await supabase.functions.invoke('alfie-consume-visuals', {
          body: { 
            cost_visuals: amount,
            brand_id: activeBrandId 
          },
          headers
        });
        
        if (consumeError) {
          toast.error('Impossible de consommer le quota');
          return false;
        }
        
        console.log(`[Quota] Consumed ${amount} visuals for brand ${activeBrandId}`);
      } else {
        // Pour woofs : vérification seulement, le backend consommera
        console.log(`[Quota] Woofs verified (${amount} available), backend will consume`);
      }
      
      return true;
    } catch (error: any) {
      console.error('[Quota] Error:', error);
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
      console.log(`[Refund] ${amount} Woofs remboursés`);
    } catch (error) {
      console.error('[Refund] Error:', error);
    }
  };
  
  // const _refundVisuals = async (amount: number) => {
  //   if (!activeBrandId) return;
  //   try {
  //     await supabase.rpc('refund_brand_quotas', {
  //       p_brand_id: activeBrandId,
  //       p_visuals_count: amount
  //     });
  //     console.log(`[Refund] ${amount} Visuels remboursés`);
  //   } catch (error) {
  //     console.error('[Refund] Error:', error);
  //   }
  // };
  
  // ======
  // GÉNÉRATION D'IMAGES
  // ======
  
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
  
  const generateImage = async (prompt: string, aspectRatio: string) => {
    const woofCost = 1;
    
    // 1. Vérifier et consommer quota
    const quotaOk = await checkAndConsumeQuota('woofs', woofCost);
    if (!quotaOk) return;
    
    // 2. Message de génération
    addMessage({
      role: 'assistant',
      content: uploadedImage 
        ? '🎨 Génération basée sur ton image...' 
        : '🎨 Génération de ton image en cours...',
      type: 'text'
    });
    
    try {
      const headers = await getAuthHeader();
      
      // 3. Préparer le body avec l'image uploadée si présente
      const body: any = {
        provider: 'gemini-nano',
        prompt,
        format: mapAspectRatio(aspectRatio),
        brand_id: activeBrandId,
        cost_woofs: woofCost
      };
      
      // ✅ Ajouter l'image de référence si uploadée
      if (uploadedImage) {
        body.templateImageUrl = uploadedImage;
      }
      
      // 3. Appeler alfie-render-image
      const { data, error } = await supabase.functions.invoke('alfie-render-image', {
        body,
        headers
      });
      
      if (error) throw error;
      
      if (!data?.ok || !data?.data?.image_urls?.[0]) {
        throw new Error(data?.error || 'Aucune image générée');
      }
      
      // 4. Afficher l'image
      addMessage({
        role: 'assistant',
        content: '✅ Image générée avec succès !',
        type: 'image',
        assetUrl: data.data.image_urls[0],
        assetId: data.data.generation_id
      });
      
      toast.success('Image générée !');
      
      // ✅ Réinitialiser uploadedImage après génération
      setUploadedImage(null);
      
    } catch (error: any) {
      console.error('[Image] Error:', error);
      await refundWoofs(woofCost);
      
      const errorMsg = error.message?.toLowerCase() || '';
      let friendlyError = '❌ Une erreur est survenue. Pas de panique, réessaye dans un instant !';
      
      if (errorMsg.includes('quota')) {
        friendlyError = '😅 Oups, tu as atteint ta limite mensuelle ! Passe à un plan supérieur pour continuer.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        friendlyError = '🌐 Problème de connexion. Vérifie ta connexion internet et réessaye.';
      } else if (errorMsg.includes('timeout')) {
        friendlyError = '⏱️ La génération a pris trop de temps. Réessaye dans quelques instants.';
      }
      
      addMessage({
        role: 'assistant',
        content: friendlyError,
        type: 'text'
      });
      toast.error('Échec de la génération d\'image');
    }
  };
  
  // ======
  // GÉNÉRATION DE VIDÉOS
  // ======
  
  const generateVideo = async (prompt: string, aspectRatio: string) => {
    // Déterminer le coût en Woofs (1-3 selon durée détectée)
    const duration = prompt.match(/(\d+)\s*s/)?.[1];
    let woofCost = 1;
    if (duration) {
      const seconds = parseInt(duration);
      if (seconds <= 8) woofCost = 1;
      else if (seconds <= 15) woofCost = 2;
      else woofCost = 3;
    }
    
    // 1. Vérifier et consommer quota
    const quotaOk = await checkAndConsumeQuota('woofs', woofCost);
    if (!quotaOk) return;
    
    // 2. Message de génération
    addMessage({
      role: 'assistant',
      content: uploadedImage
        ? `🎬 Génération vidéo lancée à partir de ton image (${woofCost} Woofs)...`
        : `🎬 Génération vidéo lancée (${woofCost} Woofs)...`,
      type: 'text'
    });
    
    try {
      const headers = await getAuthHeader();
      
      // 3. Appeler generate-video
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt,
          aspectRatio,
          brandId: activeBrandId,
          woofCost,
          ...(uploadedImage ? { imageUrl: uploadedImage } : {})
        },
        headers
      });
      
      if (error) throw error;
      
      if (!data?.jobId) {
        throw new Error('Aucun jobId reçu');
      }
      
      // 4. Afficher placeholder et démarrer le polling
      const messageId = addMessage({
        role: 'assistant',
        content: '⏳ Vidéo en cours de génération...',
        type: 'video',
        metadata: { jobId: data.jobId, status: 'processing' }
      });
      
      pollVideoStatus(data.jobId, messageId, woofCost);
      
      // ✅ Clear uploaded image after starting video generation
      if (uploadedImage) {
        setUploadedImage(null);
      }
      
    } catch (error: any) {
      console.error('[Video] Error:', error);
      await refundWoofs(woofCost);
      
      const errorMsg = error.message?.toLowerCase() || '';
      let friendlyError = '❌ Une erreur est survenue. Pas de panique, réessaye dans un instant !';
      
      if (errorMsg.includes('quota')) {
        friendlyError = '😅 Oups, tu as atteint ta limite mensuelle ! Passe à un plan supérieur pour continuer.';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        friendlyError = '🌐 Problème de connexion. Vérifie ta connexion internet et réessaye.';
      } else if (errorMsg.includes('timeout')) {
        friendlyError = '⏱️ La génération a pris trop de temps. Réessaye dans quelques instants.';
      }
      
      addMessage({
        role: 'assistant',
        content: friendlyError,
        type: 'text'
      });
      toast.error('Échec de la génération de vidéo');
    }
  };
  
  const pollVideoStatus = (jobId: string, messageId: string, woofCost: number) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('media_generations')
          .select('status, output_url')
          .eq('id', jobId)
          .single();
        
        if (data?.status === 'completed') {
          clearInterval(interval);
          delete videoPollingRef.current[jobId];
          
          updateMessage(messageId, {
            content: '✅ Vidéo générée !',
            assetUrl: data.output_url,
            metadata: { jobId, status: 'completed' }
          });
          
          toast.success('Vidéo générée avec succès !');
        } else if (data?.status === 'failed') {
          clearInterval(interval);
          delete videoPollingRef.current[jobId];
          
          updateMessage(messageId, {
            content: '❌ Échec de la génération',
            metadata: { jobId, status: 'failed' }
          });
          
          // Rembourser les Woofs
          await refundWoofs(woofCost);
          toast.error('Échec de la génération de vidéo');
        }
      } catch (error) {
        console.error('[Poll] Error:', error);
      }
    }, 5000);
    
    videoPollingRef.current[jobId] = interval;
  };
  
  // ======
  // GÉNÉRATION DE CARROUSELS PROGRESSIVE (NOUVEAU)
  // ======
  
  // Utilitaire : construire un prompt depuis un slide (ancien format)
  const buildPromptFromSlide = (slide: any, aspectRatio: string, brandKit?: any): string => {
    const parts = [];
    if (slide?.title) parts.push(`Illustration pour "${slide.title}"`);
    if (slide?.subtitle) parts.push(`Contexte: ${slide.subtitle}`);
    parts.push('Pas de texte dans l\'image, fond uniquement');
    parts.push(`Ratio ${aspectRatio}`);
    if (brandKit?.palette?.length) parts.push(`Couleurs: ${brandKit.palette.join(', ')}`);
    return parts.join('. ') + '.';
  };
  
  // Utilitaire : normaliser le plan (accepte nouveau et ancien format)
  const normalizeCarouselPlan = (raw: any, count: number, aspectRatio: string, brandKit?: any) => {
    let style = raw?.style;
    let prompts: string[] | undefined = Array.isArray(raw?.prompts) ? raw.prompts : undefined;
    let slides: any[] | undefined = Array.isArray(raw?.slides) ? raw.slides : undefined;
    
    // Si format ancien : { plan: { slides: [...] } }
    if ((!style || !prompts || !slides) && Array.isArray(raw?.plan?.slides)) {
      const oldSlides = raw.plan.slides.slice(0, count);
      prompts = oldSlides.map((s: any) => 
        s?.note?.trim?.() || buildPromptFromSlide(s, aspectRatio, brandKit)
      );
      style = style || `Style cohérent, moderne et créatif, sans texte incrusté, ratio ${aspectRatio}${brandKit?.palette?.length ? `, palette ${brandKit.palette.join(', ')}` : ''}.`;
      
      // Convertir l'ancien format vers le nouveau
      slides = oldSlides.map((s: any, i: number) => ({
        type: i === 0 ? 'hero' : i === count - 1 ? 'cta' : 'problem',
        title: s?.title || `Slide ${i + 1}`,
        subtitle: s?.subtitle,
        bullets: s?.bullets,
        cta_primary: s?.cta || 'En savoir plus',
        note: s?.note
      }));
    }
    
    // Garantir des arrays valides
    if (!Array.isArray(prompts)) prompts = [];
    if (!Array.isArray(slides)) slides = [];
    
    // Ajuster la longueur des prompts
    if (prompts.length > count) prompts = prompts.slice(0, count);
    while (prompts.length < count) {
      prompts.push(prompts[prompts.length - 1] || `Fond abstrait, ratio ${aspectRatio}, sans texte`);
    }
    
    // Ajuster la longueur des slides
    if (slides.length > count) slides = slides.slice(0, count);
    while (slides.length < count) {
      slides.push({
        type: 'cta',
        title: 'En savoir plus',
        cta_primary: 'Découvrir'
      });
    }
    
    return { style, prompts, slides };
  };
  
  const generateCarouselProgressive = async (prompt: string, count: number = 5) => {
    let successCount = 0;
    
    try {
      setIsLoading(true);
      setCarouselProgress({ current: 0, total: count });
      
      addMessage({
        role: 'assistant',
        content: `🎨 Génération d'un carrousel de ${count} slides...`,
        type: 'text'
      });
      
      // Extraire l'aspect ratio du prompt (défaut 4:5)
      const aspectRatio = detectAspectRatio(prompt) || '4:5';
      
      // 1. Générer le plan simplifié
      const { data: planData, error: planError } = await supabase.functions.invoke('alfie-plan-carousel', {
        body: { 
          prompt, 
          slideCount: count,
          aspectRatio: aspectRatio,
          brandKit: {
            name: brandKit?.name,
            palette: brandKit?.palette,
            voice: brandKit?.voice,
            niche: brandKit?.niche
          }
        }
      });
      
      // Log du plan brut pour diagnostic
      console.log('[Carousel] Raw plan:', planData);
      console.log('[Carousel] Raw plan keys:', Object.keys(planData || {}));
      
      // Normaliser le plan (supporte les deux formats)
      const { style: globalStyle, prompts, slides } = normalizeCarouselPlan(
        planData, 
        count, 
        aspectRatio, 
        brandKit
      );
      
      if (planError || !globalStyle || !prompts?.length || !slides?.length) {
        throw new Error(planError?.message || 'Plan invalide (aucun prompt utilisable)');
      }
      
      console.log('[Carousel] Using prompts count:', prompts.length);
      console.log('[Carousel] Using slides count:', slides.length);
      console.log('[Carousel] Style:', globalStyle.substring(0, 100));
      
      addMessage({
        role: 'assistant',
        content: `✅ Plan créé ! Style: ${globalStyle.substring(0, 100)}...\n\nGénération des ${prompts.length} slides en cours...`,
        type: 'text'
      });
      
      // 2. Générer chaque slide progressivement
      for (let i = 0; i < prompts.length; i++) {
        const slidePrompt = prompts[i];
        setCarouselProgress({ current: i + 1, total: prompts.length });
        
        console.log(`[Carousel] Generating slide ${i + 1}/${prompts.length}...`);
        
        try {
          const { data: imgData, error: imgError } = await supabase.functions.invoke(
            'alfie-render-carousel-slide',
            {
              body: {
                prompt: prompts[i],
                globalStyle,
                slideContent: slides[i],
                brandId: activeBrandId,
                aspectRatio
              }
            }
          );
          
          // Récupération d'URL tolérante (supporte plusieurs formats)
          const imageUrl = imgData?.data?.image_urls?.[0] || imgData?.image_urls?.[0] || imgData?.image_url;
          
          if (imgError || !imageUrl) {
            console.error(`[Carousel] Slide ${i + 1} generation failed:`, imgError, imgData);
            toast.error(`Slide ${i + 1} a échoué`);
            continue;
          }
          
          successCount++;
          console.log(`[Carousel] ✅ Slide ${i + 1} generated`);
          
          // Afficher immédiatement la slide générée
          addMessage({
            role: 'assistant',
            content: `✅ Slide ${i + 1}/${prompts.length}`,
            type: 'image',
            assetUrl: imageUrl,
            reasoning: slidePrompt
          });
          
          toast.success(`Slide ${i + 1}/${prompts.length} générée !`);
          
        } catch (slideError) {
          console.error(`[Carousel] Error generating slide ${i + 1}:`, slideError);
          toast.error(`Erreur sur la slide ${i + 1}`);
        }
      }
      
      // 3. Finalisation
      setCarouselProgress(null);
      addMessage({
        role: 'assistant',
        content: `🎉 Carrousel terminé ! ${successCount}/${prompts.length} slides générées avec succès.`,
        type: 'text'
      });
      toast.success(`✅ Carrousel terminé : ${successCount}/${prompts.length} slides !`);
      
    } catch (error: any) {
      console.error('[Carousel] Error:', error);
      setCarouselProgress(null);
      
      addMessage({
        role: 'assistant',
        content: `❌ Échec de la génération du carrousel.\n\n${error.message || 'Erreur inconnue'}`,
        type: 'text'
      });
      toast.error('Échec de la génération du carrousel');
    } finally {
      setIsLoading(false);
    }
  };
  
  // L'ancienne fonction generateCarousel est supprimée et remplacée par generateCarouselProgressive
  
  // const _subscribeToCarousel = (jobSetId: string, total: number) => {
  //   // Nettoyer l'ancien canal si présent
  //   if (carouselChannelRef.current) {
  //     supabase.removeChannel(carouselChannelRef.current);
  //   }
  //   
  //   const channel = supabase
  //     .channel(`carousel-${jobSetId}`)
  //     .on('postgres_changes', {
  //       event: 'UPDATE',
  //       schema: 'public',
  //       table: 'jobs',
  //       filter: `job_set_id=eq.${jobSetId}`
  //     }, () => {
  //       // Recompter les jobs terminés
  //       updateCarouselProgress(jobSetId, total);
  //     })
  //     .subscribe();
  //   
  //   carouselChannelRef.current = channel;
  //   
  //   // Polling de secours toutes les 10s
  //   const pollInterval = setInterval(async () => {
  //     await updateCarouselProgress(jobSetId, total);
  //     
  //     // Arrêter le polling si terminé
  //     if (carouselProgress.done >= total) {
  //       clearInterval(pollInterval);
  //     }
  //   }, 10000);
  // };
  
  // const updateCarouselProgress = async (jobSetId: string, total: number) => {
  //   try {
  //     const { data: jobs } = await supabase
  //       .from('jobs')
  //       .select('status')
  //       .eq('job_set_id', jobSetId);
  //     
  //     if (!jobs) return;
  //     
  //     const done = jobs.filter(j => j.status === 'succeeded' || j.status === 'completed').length;
  //     setCarouselProgress({ done, total });
  //     
  //     // Mettre à jour le message de progression
  //     setMessages(prev => prev.map(m => {
  //       if (m.type === 'carousel' && m.metadata?.jobSetId === jobSetId) {
  //         return {
  //           ...m,
  //           content: done >= total 
  //             ? `✅ Carrousel terminé (${done}/${total}) !`
  //             : `⏳ Génération en cours (${done}/${total})...`,
  //           metadata: { ...m.metadata, done }
  //         };
  //       }
  //       return m;
  //     }));
  //     
  //     // Si terminé, charger les assets
  //     if (done >= total) {
  //       const { data: assets } = await supabase
  //         .from('assets')
  //         .select('id, storage_key')
  //         .eq('job_set_id', jobSetId)
  //         .order('index_in_set', { ascending: true });
  //       
  //       if (assets && assets.length > 0) {
  //         // Afficher les slides générées
  //         addMessage({
  //           role: 'assistant',
  //           content: `✅ ${assets.length} slides générées avec succès !`,
  //           type: 'text',
  //           metadata: { 
  //             jobSetId, 
  //             assetIds: assets.map(a => a.id),
  //             assetUrls: assets.map(a => {
  //               const { data } = supabase.storage.from('media-generations').getPublicUrl(a.storage_key);
  //               return data.publicUrl;
  //             })
  //           }
  //         });
  //         
  //         toast.success(`Carrousel terminé ! ${assets.length} slides générées.`);
  //       }
  //     }
  //   } catch (error) {
  //     console.error('[Carousel] Progress update error:', error);
  //   }
  // };
  
  // Cleanup des subscriptions et polling
  useEffect(() => {
    return () => {
      // Nettoyer le polling des vidéos
      Object.values(videoPollingRef.current).forEach(clearInterval);
      
      // Nettoyer le canal carrousel
      if (carouselChannelRef.current) {
        supabase.removeChannel(carouselChannelRef.current);
      }
    };
  }, []);
  
  // ======
  // ORCHESTRATOR BACKEND
  // ======
  
  const orchestratorSend = async (userMessage: string): Promise<boolean> => {
    try {
      const headers = await getAuthHeader();
      
      // Construire l'historique complet
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      
      conversationHistory.push({
        role: 'user',
        content: userMessage,
        ...(uploadedImage ? { imageUrl: uploadedImage } : {})
      });
      
      // Appeler l'orchestrateur backend
      console.log('[Orchestrator] Sending to backend:', {
        messageCount: conversationHistory.length,
        lastMessage: conversationHistory[conversationHistory.length - 1],
        brandId: activeBrandId
      });

      const { data, error } = await supabase.functions.invoke('alfie-chat', {
        body: {
          messages: conversationHistory,
          brandId: activeBrandId,
          expertMode: true,
          stream: false
        },
        headers
      });
      
      console.log('[Orchestrator] Backend response:', {
        hasData: !!data,
        error: error,
        hasAssets: !!data?.assets,
        assetsCount: data?.assets?.length || 0,
        imageUrlsCount: data?.data?.image_urls?.length || 0,
        hasJobSetId: !!data?.jobSetId,
        noToolCalls: data?.noToolCalls,
        noCredits: data?.noCredits,
        messageContent: data?.choices?.[0]?.message?.content?.substring(0, 200)
      });
      
      if (error) throw error;
      
      // Parser la réponse
      const assistantMessage = data?.choices?.[0]?.message;
      if (!assistantMessage) {
        throw new Error('No assistant message in response');
      }
      
      // ✅ Gérer le flag noToolCalls
      if (data.noToolCalls === true && (!data.assets || data.assets.length === 0)) {
        console.warn('[Orchestrator] ⚠️ No tool calls from AI, triggering local fallback');
        addMessage({
          role: 'assistant',
          content: '🤔 L\'IA n\'a pas exécuté les outils attendus. Je vais essayer de t\'aider autrement.\n\nPeux-tu reformuler ta demande de façon plus claire ? Par exemple:\n- "Crée-moi un carrousel 4:5 de 5 slides sur X"\n- "Génère une image 1:1 pour Y"\n- "Fais-moi une vidéo sur Z"',
          type: 'text'
        });
        return false;
      }
      
      // ✅ Gérer le flag noCredits (plan textuel sans images)
      if (data.noCredits === true) {
        console.log('[Orchestrator] No credits flag detected');
        toast.error('💳 Crédits insuffisants - Plan généré sans images');
      }
      
      // Afficher le message de l'assistant
      addMessage({
        role: 'assistant',
        content: assistantMessage.content || '',
        type: 'text'
      });
      
      // Traiter les assets s'il y en a
      if (data.assets && Array.isArray(data.assets) && data.assets.length > 0) {
        toast.success(`✅ ${data.assets.length} asset${data.assets.length > 1 ? 's' : ''} généré${data.assets.length > 1 ? 's' : ''} !`);
        
        for (const asset of data.assets) {
          if (asset.type === 'image') {
            addMessage({
              role: 'assistant',
              content: asset.title ? `✅ ${asset.title}` : '✅ Image générée !',
              type: 'image',
              assetUrl: asset.url,
              reasoning: asset.reasoning,
              brandAlignment: asset.brandAlignment
            });
          }
        }
      } else if (!data.assets || data.assets.length === 0) {
        // ✅ Fallback: vérifier si l'image est dans data.imageUrl ou data.data.image_urls
        const imageUrl = data.imageUrl || data.data?.image_urls?.[0];
        if (imageUrl) {
          console.log('[Orchestrator] Found image in alternate format:', imageUrl.substring(0, 80));
          addMessage({
            role: 'assistant',
            content: '✅ Image générée !',
            type: 'image',
            assetUrl: imageUrl
          });
          toast.success('✅ Image générée !');
        } else {
          console.warn('[Orchestrator] ⚠️ Response without assets or imageUrl');
          toast.warning('Réponse sans assets visuels');
        }
      }
      
      // Traiter le jobSetId si présent (pour les carrousels via job system)
      if (data.jobSetId) {
        addMessage({
          role: 'assistant',
          content: '⏳ Génération en cours...',
          type: 'carousel',
          metadata: { jobSetId: data.jobSetId, status: 'processing' }
        });
      }
      
      // ✅ Clear uploaded image after successful orchestration
      if (uploadedImage) {
        setUploadedImage(null);
      }
      
      return true;
    } catch (error: any) {
      console.error('[Orchestrator] Error:', error);
      
      // Détecter le status HTTP de l'erreur
      const status = error?.context?.response?.status || error?.status;
      const errorMsg = error.message?.toLowerCase() || '';
      
      if (status === 402 || errorMsg.includes('402') || errorMsg.includes('payment required') || errorMsg.includes('crédits insuffisants')) {
        // Erreur 402 : Crédits insuffisants
        toast.error('💳 Crédits insuffisants - Recharge maintenant');
        addMessage({
          role: 'assistant',
          content: '💳 **Crédits insuffisants**\n\nTu n\'as plus de crédits IA pour générer du contenu. Recharge tes crédits pour continuer à créer !\n\n👉 [Recharger mes crédits](/billing)',
          type: 'text'
        });
      } else if (status === 429 || errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('trop de requêtes')) {
        // Erreur 429 : Rate limit
        toast.error('⏳ Trop de requêtes - Patiente un instant');
        addMessage({
          role: 'assistant',
          content: '⏳ **Trop de requêtes**\n\nTu as fait trop de demandes en peu de temps. Patiente quelques secondes et réessaye !',
          type: 'text'
        });
      } else {
        // Erreur générique
        toast.error('Échec de l\'orchestrateur');
      }
      
      return false;
    }
  };
  
  // ======
  // HANDLER PRINCIPAL
  // ======
  
  const handleSend = async () => {
    if (isLoading || (!input.trim() && !uploadedImage)) return;
    
    if (!activeBrandId) {
      toast.error('Sélectionne une marque d\'abord !');
      return;
    }
    
    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    
    // 1. Ajouter message utilisateur
    addMessage({
      role: 'user',
      content: userMessage || '(Image jointe)',
      type: 'text'
    });
    
    try {
      // 2. Détection d'intent côté frontend AVANT l'orchestrateur
      const isCarouselRequest = userMessage.toLowerCase().match(/carrousel|carousel|slides/i);
      
      if (isCarouselRequest) {
        console.log('[Chat] Carousel request detected, using progressive generation');
        const count = extractCount(userMessage) || 5;
        await generateCarouselProgressive(userMessage, count);
        return;
      }
      
      // 3. Essayer l'orchestrateur backend pour les autres types (images, vidéos)
      console.log('[Chat] Trying orchestrator...');
      const orchestratorSuccess = await orchestratorSend(userMessage);
      
      // Si l'orchestrateur a fonctionné, on s'arrête ici
      if (orchestratorSuccess) {
        console.log('[Chat] ✅ Orchestrator success');
        return;
      }
      
      // 4. FALLBACK LOCAL si l'orchestrateur échoue
      console.log('[Chat] Orchestrator failed, using local fallback');
      const intent = detectIntent(userMessage);
      
      switch (intent) {
        case 'image': {
          const aspectRatio = detectAspectRatio(userMessage);
          await generateImage(userMessage, aspectRatio);
          break;
        }
        
        case 'video': {
          const aspectRatio = detectAspectRatio(userMessage);
          await generateVideo(userMessage, aspectRatio);
          break;
        }
        
        case 'carousel': {
          const count = extractCount(userMessage);
          await generateCarouselProgressive(userMessage, count);
          break;
        }
        
        default:
          addMessage({
            role: 'assistant',
            content: "Je ne suis pas sûr de comprendre. Tu veux créer une **image**, une **vidéo** ou un **carrousel** ? 🤔",
            type: 'text'
          });
      }
    } catch (error) {
      console.error('Error in handleSend:', error);
      addMessage({
        role: 'assistant',
        content: '❌ Une erreur inattendue est survenue. Veuillez réessayer.',
        type: 'text'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // ======
  // UPLOAD D'IMAGE
  // ======
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        toast.success('Image uploadée ! Décris ce que tu veux en faire.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[Upload] Error:', error);
      toast.error('Erreur lors de l\'upload');
    }
  };
  
  // ======
  // RENDU
  // ======
  
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <CreateHeader />
      
      {/* Quota Bar */}
      {activeBrandId && <QuotaBar activeBrandId={activeBrandId} />}
      
      {/* Carousel Progress Bar */}
      {carouselProgress && (
        <div className="px-4 py-3 bg-primary/10 border-b">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm mb-2">
              Génération : {carouselProgress.current}/{carouselProgress.total} slides
            </p>
            <Progress 
              value={(carouselProgress.current / carouselProgress.total) * 100}
              className="h-2"
            />
          </div>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <Avatar className="h-8 w-8 border-2 border-primary">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  🐾
                </AvatarFallback>
              </Avatar>
            )}
            
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {/* Message texte */}
              {(!message.type || message.type === 'text') && (
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  
                  {/* Affichage du reasoning si présent */}
                  {message.reasoning && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mt-2 text-sm border border-purple-200 dark:border-purple-800">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">💡</span>
                        <div className="flex-1">
                          <p className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                            Pourquoi ce choix créatif ?
                          </p>
                          <p className="text-purple-700 dark:text-purple-300 text-xs leading-relaxed">
                            {message.reasoning}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Affichage du Brand Kit alignment si présent */}
                  {message.brandAlignment && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg mt-2 text-sm border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🎨</span>
                        <div className="flex-1">
                          <p className="font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
                            Cohérence Brand Kit
                          </p>
                          <p className="text-emerald-700 dark:text-emerald-300 text-xs leading-relaxed">
                            {message.brandAlignment}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Message image */}
              {message.type === 'image' && message.assetUrl && (
                <div className="space-y-2">
                  <p className="text-sm">{message.content}</p>
                  <img
                    src={message.assetUrl}
                    alt="Generated"
                    className="rounded-lg w-full"
                  />
                  
                  {/* Reasoning pour images */}
                  {message.reasoning && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-sm border border-purple-200 dark:border-purple-800">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">💡</span>
                        <div className="flex-1">
                          <p className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                            Direction artistique
                          </p>
                          <p className="text-purple-700 dark:text-purple-300 text-xs leading-relaxed">
                            {message.reasoning}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Message vidéo */}
              {message.type === 'video' && (
                <div className="space-y-2">
                  <p className="text-sm">{message.content}</p>
                  {message.assetUrl && (
                    <video
                      src={message.assetUrl}
                      controls
                      className="rounded-lg w-full"
                    />
                  )}
                  {message.metadata?.status === 'processing' && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              )}
              
              {/* Message carrousel */}
              {message.type === 'carousel' && (
                <div className="space-y-2">
                  <p className="text-sm">{message.content}</p>
                  {message.metadata?.total && (
                    <Progress 
                      value={(message.metadata.done / message.metadata.total) * 100} 
                      className="w-full"
                    />
                  )}
                  {message.metadata?.assetUrls && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {message.metadata.assetUrls.map((url: string, i: number) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Slide ${i + 1}`}
                          className="rounded-lg w-full"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {message.role === 'user' && (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Composer */}
      <div className="border-t bg-background p-4">
        {uploadedImage && (
          <div className="mb-2 relative inline-block">
            <img
              src={uploadedImage}
              alt="Upload preview"
              className="h-20 rounded-lg border"
            />
            <Button
              size="sm"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
              onClick={() => setUploadedImage(null)}
            >
              ×
            </Button>
          </div>
        )}
        
        <div className="flex gap-2 items-end">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileUpload}
          />
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          
          <TextareaAutosize
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Décris ce que tu veux créer..."
            className="flex-1 resize-none rounded-lg border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            minRows={1}
            maxRows={5}
            disabled={isLoading}
          />
          
          <Button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !uploadedImage)}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
