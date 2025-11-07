import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Send, ImagePlus, Loader2, Download } from 'lucide-react';
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
import { useLibraryAssetsSubscription } from '@/hooks/useLibraryAssetsSubscription';
import { getAspectClass, type ConversationState, type OrchestratorResponse } from '@/types/chat';
import { slideUrl } from '@/lib/cloudinary/imageUrls';
import { extractCloudNameFromUrl } from '@/lib/cloudinary/utils';

const normalizeConversationState = (state?: string | null): ConversationState => {
  switch (state) {
    case 'generating':
      return 'generating';
    case 'completed':
      return 'completed';
    default:
      return 'idle';
  }
};
// ======
// TYPES
// ======

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image' | 'video' | 'carousel' | 'reasoning' | 'bulk-carousel';
  assetUrl?: string;
  assetId?: string;
  metadata?: any;
  reasoning?: string;
  brandAlignment?: string;
  quickReplies?: string[];
  bulkCarouselData?: {
    carousels: Array<{
      carousel_index: number;
      slides: Array<{
        storage_url: string;
        index: number;
      }>;
      zip_url?: string;
    }>;
    totalCarousels: number;
    slidesPerCarousel: number;
  };
  timestamp: Date;
}

// ======
// COMPOSANT PRINCIPAL
// ======

export function AlfieChat() {
  const { user } = useAuth();
  const { activeBrandId } = useBrandKit();
  
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null);

  // Subscription aux assets de l'order
  const { assets: orderAssets, total: orderTotal } = useLibraryAssetsSubscription(orderId);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seenAssetsRef = useRef(new Set<string>()); // stocke les URLs déjà annoncées
  const finishAnnouncedRef = useRef<string | null>(null);

  useEffect(() => {
    seenAssetsRef.current = new Set<string>();
    finishAnnouncedRef.current = null;
    setExpectedTotal(null);
  }, [orderId]);

  useEffect(() => {
    if (orderTotal > 0) {
      setExpectedTotal(orderTotal);
    }
  }, [orderTotal]);
  
  // ======
  // RESTAURATION D'ÉTAT APRÈS REFRESH
  // ======
  
  useEffect(() => {
    const restoreSessionState = async () => {
      if (orderId || !user?.id) return;
      
      console.log('[Chat] Restoring session state for user:', user.id);
      
      const { data, error } = await supabase
        .from('alfie_conversation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!error && data?.order_id) {
        console.log('[Chat] Restored session:', data.order_id);
        setOrderId(data.order_id);
        setConversationId(data.id);
        setConversationState(normalizeConversationState(data.conversation_state));
      }
    };
    
    restoreSessionState();
  }, [user?.id]);
  
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
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // ======
  // SYSTEM MESSAGE WHEN GENERATING
  // ======
  
  useEffect(() => {
    if (conversationState === 'generating' && orderId) {
      // Add system message to chat thread
      const hasGeneratingMessage = messages.some(
        m => m.role === 'assistant' && m.content.includes('🚀 Génération en cours')
      );
      
      if (!hasGeneratingMessage) {
        addMessage({
          role: 'assistant',
          content: '🚀 Génération en cours... Je te tiens au courant dès que c\'est prêt !',
          type: 'text'
        });
      }
    }
  }, [conversationState, orderId, messages]);
  
  // ======
  // AFFICHAGE TEMPS RÉEL DES NOUVEAUX ASSETS
  // ======
  
  useEffect(() => {
    if (!orderId || !orderAssets.length) return;

    // Afficher chaque nouveau asset dans le chat
    for (const asset of orderAssets) {
      const key = asset.url || asset.id;
      if (!key || seenAssetsRef.current.has(key)) continue;

      seenAssetsRef.current.add(key);

      const isCarouselSlide = asset.type === 'carousel_slide';
      addMessage({
        role: 'assistant',
        content: isCarouselSlide
          ? `✅ Slide ${asset.slideIndex + 1} générée !`
          : '✅ Image générée !',
        type: isCarouselSlide ? 'carousel' : 'image',
        assetUrl: asset.url,
        metadata: isCarouselSlide
          ? { assetUrls: [{ url: asset.url, format: asset.format || '4:5' }] }
          : undefined
      });
    }

    // Annoncer la fin de génération une seule fois
    const targetTotal = expectedTotal ?? orderTotal ?? 0;
    const canAnnounce =
      conversationState === 'generating' &&
      targetTotal > 0 &&
      orderAssets.length >= targetTotal &&
      finishAnnouncedRef.current !== orderId;

    if (canAnnounce) {
      console.log('[Chat] 🎉 Génération terminée !', { 
        assets: orderAssets.length, 
        total: targetTotal 
      });

      setConversationState('completed');
      finishAnnouncedRef.current = orderId;

      addMessage({
        role: 'assistant',
        content: '🎉 Génération terminée ! Tes visuels sont prêts dans la Bibliothèque.',
        quickReplies: ['Voir la bibliothèque', 'Créer un nouveau visuel'],
        type: 'text'
      });
    }
    
    // Fallback: si des assets arrivent mais qu'on n'a pas de total précis
    if (conversationState === 'generating' && 
        orderAssets.length > 0 && 
        !targetTotal &&
        finishAnnouncedRef.current !== orderId) {
      
      console.log('[Chat] 📦 Assets détectés sans total connu');
      finishAnnouncedRef.current = orderId;
      
      addMessage({
        role: 'assistant',
        content: '📦 Des visuels ont été générés ! Retrouve-les dans la Bibliothèque.',
        quickReplies: ['Voir la bibliothèque'],
        type: 'text'
      });
    }
  }, [orderAssets, orderId, conversationState, orderTotal, expectedTotal]);
  
  // ======
  // REALTIME JOB MONITORING
  // ======
  
  useEffect(() => {
    if (!orderId) return;
    
    console.log('[Realtime] Starting job monitoring for order:', orderId);
    
    const channel = supabase
      .channel('job_queue_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'job_queue',
        filter: `order_id=eq.${orderId}`
      }, (payload) => {
        const job = payload.new as any;
        console.log('[Realtime] Job update:', job);
        
        if (job.status === 'completed') {
          const assetUrl = job.result?.assetUrl || job.result?.images?.[0] || job.result?.carousels?.[0]?.slides?.[0]?.url;
          
          if (assetUrl) {
            let type: 'image' | 'carousel' | 'video' = 'image';
            let content = '✅ Génération terminée !';
            
            if (job.type === 'render_images') {
              type = 'image';
              content = '✅ Image générée !';
            } else if (job.type === 'render_carousels') {
              type = 'carousel';
              content = '✅ Slide de carrousel générée !';
            } else if (job.type === 'generate_video') {
              type = 'video';
              content = '✅ Vidéo générée !';
            }
            
            addMessage({
              role: 'assistant',
              content,
              type,
              assetUrl,
              assetId: job.id
            });
            
            toast.success(content);
          }
        } else if (job.status === 'failed') {
          const errorContent = `❌ Erreur : ${job.error || 'Génération échouée'}`;
          addMessage({
            role: 'assistant',
            content: errorContent,
            type: 'text'
          });
          toast.error('Échec de la génération');
        }
      })
      .subscribe();
    
    return () => {
      console.log('[Realtime] Cleaning up job monitoring');
      supabase.removeChannel(channel);
    };
  }, [orderId]);
  
  // ======
  // HANDLER PRINCIPAL (ORCHESTRATOR-BASED)
  // ======
  
  const handleSend = async (override?: string) => {
    const messageToSend = (override ?? input).trim();
    if (isLoading || !messageToSend) return;

    if (!activeBrandId) {
      toast.error('Sélectionne une marque d\'abord !');
      return;
    }

    const userMessage = messageToSend;
    setInput('');
    setIsLoading(true);

    // 1. Ajouter message utilisateur
    addMessage({
      role: 'user',
      content: userMessage,
      type: 'text'
    });

    // 1bis. Commande de monitoring simple: /queue
    if (userMessage.startsWith('/queue')) {
      try {
        const headers = await getAuthHeader();
        const { data, error } = await supabase.functions.invoke('queue-monitor', { headers });
        if (error) throw error;
        
        interface QueueMonitorResponse {
          counts?: { 
            completed_24h?: number; 
            pending?: number; 
            running?: number;
            queued?: number;
            failed?: number;
          };
          backlogSeconds?: number;
          stuck?: { runningStuckCount?: number };
        }
        
        const response = data as QueueMonitorResponse;
        const c = response?.counts || {};
        const oldest = response?.backlogSeconds ?? null;
        const stuck = response?.stuck?.runningStuckCount ?? 0;
        const completed24h = c.completed_24h ?? 0;
        const minutes = oldest ? Math.max(0, Math.round((oldest as number) / 60)) : null;

        addMessage({
          role: 'assistant',
          content: [
            '📊 État de la file de jobs:',
            `• queued: ${c.queued ?? 0}`,
            `• running: ${c.running ?? 0}`,
            `• failed: ${c.failed ?? 0}`,
            `• completed (24h): ${completed24h}`,
            `• plus ancien en attente: ${minutes !== null ? minutes + ' min' : 'n/a'}`,
            `• jobs bloqués (>5min): ${stuck}`
          ].join('\n'),
          type: 'text'
        });
      } catch (e: any) {
        addMessage({
          role: 'assistant',
          content: `❌ Monitoring indisponible: ${e?.message || e}`,
          type: 'text'
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // 2. Appeler l'orchestrator avec retry (3 tentatives)
    let lastError: any = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const headers = await getAuthHeader();

        
        console.log(`[Chat] Calling orchestrator (attempt ${attempt}/${maxRetries}):`, {
          message: userMessage.substring(0, 50),
          conversationId,
          brandId: activeBrandId
        });

        const { data, error } = await supabase.functions.invoke('alfie-orchestrator', {
          body: { message: userMessage, conversationId, brandId: activeBrandId },
          headers
        });

        if (error) throw error;

        const payload = (data ?? null) as OrchestratorResponse | null;
        console.log('[Chat] Orchestrator response:', payload);

        if (payload?.conversationId) {
          setConversationId(payload.conversationId);
        }

        if (payload?.orderId) {
          console.log('[Chat] Order created:', payload.orderId);
          setOrderId(payload.orderId);
          setConversationState('generating');
          
          // Ajouter immédiatement un message pour rediriger vers la bibliothèque
          addMessage({
            role: 'assistant',
            content: '🚀 Génération lancée ! Tu peux suivre l\'avancement et télécharger tes visuels directement dans la Bibliothèque.',
            type: 'text',
            quickReplies: ['Voir la bibliothèque']
          });
        }

        if (typeof payload?.totalSlides === 'number') {
          setExpectedTotal(payload.totalSlides);
        }

        if (payload?.state) {
          setConversationState(normalizeConversationState(payload.state));
        }

        if (payload?.response) {
          const quickReplies = Array.isArray(payload.quickReplies) && payload.quickReplies.length > 0
            ? payload.quickReplies
            : undefined;

          addMessage({
            role: 'assistant',
            content: payload.response,
            type: 'text',
            quickReplies,
            reasoning: payload.reasoning,
            brandAlignment: payload.brandAlignment
          });
        }

        if (payload?.bulkCarouselData) {
          addMessage({
            role: 'assistant',
            content: '📦 Génération en masse terminée !',
            type: 'bulk-carousel',
            bulkCarouselData: payload.bulkCarouselData
          });
        }

        setIsLoading(false);
        return;

      } catch (error: any) {
        lastError = error;
        console.error(`[Chat] Error (attempt ${attempt}/${maxRetries}):`, error);
        
        // Si c'est la dernière tentative, on arrête
        if (attempt === maxRetries) break;
        
        // Sinon, on attend avant de retry (backoff exponentiel)
        const delay = 600 * attempt; // 600ms, 1200ms, 1800ms
        console.log(`[Chat] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Si on arrive ici, toutes les tentatives ont échoué
    console.error('[Chat] All retry attempts failed:', lastError);
    
    addMessage({
      role: 'assistant',
      content: '❌ Impossible de lancer la génération après plusieurs tentatives. Réessaye dans quelques instants.',
      type: 'text'
    });
    toast.error('Échec après 3 tentatives');
    setIsLoading(false);
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
  // QUICK REPLIES COMPONENT
  // ======
  
  const QuickRepliesButtons = ({ replies, onSelect }: { replies: string[]; onSelect: (reply: string) => Promise<void> | void }) => {
    if (replies.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2">
        {replies.map((reply, idx) => (
          <Button
            key={idx}
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={async () => {
              // Si "Voir la bibliothèque" ET qu'on a un orderId, ouvrir la page library
              if (reply === 'Voir la bibliothèque' && orderId) {
                window.open(`/library?order=${orderId}`, '_blank');
                return;
              }
              setInput(reply);
              await onSelect(reply);
            }}
            className="text-xs"
          >
            {reply}
          </Button>
        ))}
      </div>
    );
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

                  {message.quickReplies && message.quickReplies.length > 0 && (
                    <QuickRepliesButtons
                      replies={message.quickReplies}
                      onSelect={(reply) => handleSend(reply)}
                    />
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
                      {message.metadata.assetUrls.map((entry: any, i: number) => {
                        const item = typeof entry === 'string' ? { url: entry } : entry;
                        if (!item?.url) return null;

                        const aspectClass = getAspectClass(item.format || '4:5');
                        
                        const imageUrl = (() => {
                          // Regenerate with overlays if we have publicId + text
                          if (item.publicId && item.text) {
                            const cloudName = extractCloudNameFromUrl(item.url);
                            return slideUrl(item.publicId, {
                              title: item.text.title,
                              subtitle: item.text.subtitle,
                              bulletPoints: item.text.bullets,
                              aspectRatio: item.format || '4:5',
                              cloudName,
                              baseUrlForCloudGuess: item.url,
                            });
                          }
                          
                          // Use URL directly if it's complete
                          if (item.url?.startsWith('https://')) {
                            return item.url;
                          }
                          
                          return '/placeholder.svg';
                        })();

                        return (
                          <div key={i} className={`relative ${aspectClass} rounded-lg overflow-hidden`}>
                            <img
                              src={imageUrl}
                              alt={`Slide ${i + 1}`}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                if (item.url?.startsWith('https://')) {
                                  e.currentTarget.src = item.url;
                                }
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Message bulk carrousel */}
              {message.type === 'bulk-carousel' && message.bulkCarouselData && (
                <div className="space-y-4 mt-4">
                  {message.bulkCarouselData.carousels.map((carousel: any, idx: number) => (
                    <div key={idx} className="border border-border rounded-lg p-4 bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg">
                          Carrousel {carousel.carousel_index}/{message.bulkCarouselData!.totalCarousels}
                        </h3>
                        {carousel.zip_url && (
                          <Button
                            size="sm"
                            onClick={() => window.open(carousel.zip_url, '_blank')}
                            className="gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Télécharger ZIP
                          </Button>
                        )}
                      </div>
                      
                      {/* Aperçu principal: afficher la première slide avec text overlays */}
                      {carousel.slides?.[0] && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-border">
                          <img 
                            src={(() => {
                              const firstSlide = carousel.slides[0];
                              if (firstSlide.cloudinary_public_id && firstSlide.text_json) {
                                const cloudName = extractCloudNameFromUrl(firstSlide.cloudinary_url);
                                return slideUrl(firstSlide.cloudinary_public_id, {
                                  title: firstSlide.text_json.title,
                                  subtitle: firstSlide.text_json.subtitle,
                                  bulletPoints: firstSlide.text_json.bullets,
                                  aspectRatio: firstSlide.format || '4:5',
                                  cloudName,
                                  baseUrlForCloudGuess: firstSlide.cloudinary_url,
                                });
                              }
                              return firstSlide.cloudinary_url || firstSlide.storage_url;
                            })()}
                            alt={`Aperçu carrousel ${carousel.carousel_index}`}
                            className="w-full object-cover"
                            onError={(e) => {
                              const firstSlide = carousel.slides[0];
                              if (firstSlide.cloudinary_url?.startsWith('https://')) {
                                e.currentTarget.src = firstSlide.cloudinary_url;
                              }
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Grille des slides individuelles avec aspect ratio dynamique */}
                      <div className="grid grid-cols-5 gap-2">
                        {carousel.slides?.slice(0, 5).map((slide: any, slideIdx: number) => {
                          const aspectClass = getAspectClass(slide.format || '4:5');
                          
                          const thumbUrl = (() => {
                            if (slide.cloudinary_public_id && slide.text_json) {
                              const cloudName = extractCloudNameFromUrl(slide.cloudinary_url);
                              return slideUrl(slide.cloudinary_public_id, {
                                title: slide.text_json.title,
                                subtitle: slide.text_json.subtitle,
                                bulletPoints: slide.text_json.bullets,
                                aspectRatio: slide.format || '4:5',
                                cloudName,
                                baseUrlForCloudGuess: slide.cloudinary_url,
                              });
                            }
                            return slide.cloudinary_url || slide.storage_url;
                          })();

                          return (
                            <div key={slideIdx} className={`relative ${aspectClass} rounded overflow-hidden border border-border`}>
                              <img
                                src={thumbUrl}
                                alt={`Slide ${slideIdx + 1}`}
                                className="absolute inset-0 w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  // Fallback to base Cloudinary URL if overlay fails
                                  if (slide.cloudinary_url && e.currentTarget.src !== slide.cloudinary_url) {
                                    e.currentTarget.src = slide.cloudinary_url;
                                  } else if (slide.storage_url && e.currentTarget.src !== slide.storage_url) {
                                    e.currentTarget.src = slide.storage_url;
                                  }
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
                void handleSend();
              }
            }}
            placeholder="Décris ce que tu veux créer..."
            className="flex-1 resize-none rounded-lg border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            minRows={1}
            maxRows={5}
            disabled={isLoading}
          />
          
          <Button
            onClick={() => void handleSend()}
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
