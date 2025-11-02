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
      
      if (error) {
        console.error('create-job-set error:', error);
        throw new Error(error.message || 'Erreur inconnue lors de la création du job set.');
      }
      
      const jobSetId = data?.data?.id || data?.id;
      if (!jobSetId) throw new Error('Job set ID manquant. Réponse du serveur : ' + JSON.stringify(data));
      
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
      
      const errorMessage = error.message || 'Erreur inconnue';
      
      addMessage({
        role: 'assistant',
        content: `❌ Erreur de génération de carrousel : \n\n\`\`\`\n${errorMessage}\n\`\`\``,
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
