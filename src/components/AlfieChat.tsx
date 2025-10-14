import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { Send, Sparkles, Zap, Palette, AlertCircle, ImagePlus, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import alfieMain from '@/assets/alfie-main.png';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useAlfieCredits } from '@/hooks/useAlfieCredits';
import { useTemplateLibrary } from '@/hooks/useTemplateLibrary';
import { useAlfieOptimizations } from '@/hooks/useAlfieOptimizations';
import { openInCanva } from '@/services/canvaLinker';
import { supabase } from '@/integrations/supabase/client';
import { detectIntent, canHandleLocally, generateLocalResponse } from '@/utils/alfieIntentDetector';
import { Progress } from '@/components/ui/progress';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  created_at?: string;
}

const INITIAL_ASSISTANT_MESSAGE = `Salut ! 🐾 Je suis Alfie Designer, ton compagnon créatif IA 🎨

Je peux t'aider à :
• Créer des images IA (1 crédit ✨)
• Générer des vidéos animées (2 crédits 🎬)
• Trouver des templates Canva (bientôt 🚀)
• Adapter au Brand Kit 🎨

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { brandKit } = useBrandKit();
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
          setGenerationStatus({ type: 'video', message: 'Génération de ta vidéo en cours... Cela peut prendre 2-3 minutes 🎬' });
          
          const { data, error } = await supabase.functions.invoke('generate-video', {
            body: { prompt: args.prompt }
          });

          if (error) throw error;

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");

          const predictionId = data.id;
          
          await supabase.from('media_generations').insert({
            user_id: user.id,
            type: 'video',
            prompt: args.prompt,
            output_url: '',
            status: 'processing',
            metadata: { predictionId }
          });

          // Poll for status (max 10 minutes)
          let attempts = 0;
          const maxAttempts = 120; // 10 minutes
          
          const checkStatus = async () => {
            if (attempts >= maxAttempts) {
              setGenerationStatus(null);
              toast.error("La génération prend trop de temps. Vérifie ton historique dans quelques minutes.");
              return;
            }

            try {
              const { data: statusData, error: statusError } = await supabase.functions.invoke('generate-video', {
                body: { predictionId }
              });

              if (statusError) {
                console.error('Status check error:', statusError);
                setGenerationStatus(null);
                toast.error("Erreur lors de la vérification du statut");
                return;
              }

              console.log('Video status check:', statusData.status, 'Attempt:', attempts);

              if (statusData.status === 'succeeded') {
                const videoUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
                
                const { data: existingRecords } = await supabase
                  .from('media_generations')
                  .select('id')
                  .eq('user_id', user.id)
                  .eq('type', 'video')
                  .order('created_at', { ascending: false })
                  .limit(1);
                
                if (existingRecords && existingRecords.length > 0) {
                  await supabase.from('media_generations')
                    .update({ output_url: videoUrl, status: 'completed' })
                    .eq('id', existingRecords[0].id);
                }

                // Déduire les crédits (vidéo = 2 crédits)
                await decrementCredits(2, 'video_generation');
                
                // Incrémenter le compteur de générations
                await incrementGenerations();

                setGenerationStatus(null);
                toast.success("Vidéo générée avec succès ! 🎉");
                
                const videoMessage = {
                  role: 'assistant' as const,
                  content: `Vidéo générée avec succès ! (2 crédits utilisés) 🎬`,
                  videoUrl
                };
                
                setMessages(prev => [...prev, videoMessage]);
                
                // Persister le message vidéo en base
                if (conversationId) {
                  await supabase.from('alfie_messages').insert({
                    conversation_id: conversationId,
                    role: 'assistant',
                    content: videoMessage.content,
                    video_url: videoUrl
                  });
                }
              } else if (statusData.status === 'failed') {
                setGenerationStatus(null);
                toast.error("La génération de vidéo a échoué");
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `La génération de vidéo a échoué 😔 Réessaie avec un prompt différent.`
                }]);
              } else {
                // Still processing - update status message
                attempts++;
                const elapsed = Math.floor((attempts * 5) / 60);
                setGenerationStatus({
                  type: 'video',
                  message: `Génération en cours... ${elapsed > 0 ? `(${elapsed} min)` : '(quelques secondes)'} - Les vidéos prennent 2-5 minutes 🎬`
                });
                setTimeout(checkStatus, 5000);
              }
            } catch (err) {
              console.error('Video status error:', err);
              setGenerationStatus(null);
              toast.error("Erreur lors de la vérification");
            }
          };

          setTimeout(checkStatus, 5000);

          return {
            success: true,
            message: "Génération de vidéo lancée ! Patiente quelques minutes... 🎬"
          };
        } catch (error: any) {
          console.error('Video generation error:', error);
          setGenerationStatus(null);
          return { error: error.message || "Erreur de génération vidéo" };
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

  const streamChat = async (userMessage: string) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alfie-chat`;
    
    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-5xl mx-auto w-full">
      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <div className="space-y-4 pb-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <img src={alfieMain} alt="Alfie" className="object-cover" />
                </Avatar>
              )}
               <Card
                className={`p-4 max-w-[75%] ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
               {message.imageUrl && (
                  <div className="relative group">
                    <img 
                      src={message.imageUrl} 
                      alt="Image générée" 
                      className="max-w-full rounded-lg mb-2"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = message.imageUrl!;
                        link.download = `alfie-image-${Date.now()}.png`;
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                )}
                {message.videoUrl && (
                  <div className="relative group">
                    <video 
                      src={message.videoUrl} 
                      controls
                      className="max-w-full rounded-lg mb-2"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = message.videoUrl!;
                        link.download = `alfie-video-${Date.now()}.mp4`;
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.created_at && (
                  <p className="text-xs opacity-60 mt-2">
                    {new Date(message.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    })} à {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    })}
                  </p>
                )}
              </Card>
              {message.role === 'user' && (
                <Avatar className="h-8 w-8 flex-shrink-0 bg-secondary">
                  <div className="flex items-center justify-center h-full text-secondary-foreground">
                    👤
                  </div>
                </Avatar>
              )}
            </div>
          ))}
          {(isLoading || generationStatus) && (
          <div className="flex gap-3 justify-start">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <img src={alfieMain} alt="Alfie" className="object-cover" />
            </Avatar>
              <Card className="p-4 bg-primary/10 border-primary/30">
                {generationStatus ? (
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Sparkles className="h-6 w-6 animate-spin text-primary" />
                      <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary mb-1">
                        {generationStatus.type === 'video' ? '🎬 Génération vidéo' : '✨ Génération image'}
                      </p>
                      <p className="text-sm text-muted-foreground">{generationStatus.message}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="space-y-2 pt-4 border-t">
        {/* Image preview si uploadée */}
        {uploadedImage && (
          <div className="relative inline-block">
            <img 
              src={uploadedImage} 
              alt="Preview" 
              className="h-20 rounded-lg border-2 border-primary"
            />
            <Button
              size="sm"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
              onClick={() => setUploadedImage(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || uploadingImage}
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          <Textarea
            placeholder="Décris ton idée à Alfie..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[60px] resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="lg"
            className="gap-2"
          >
            {isLoading ? (
              <Sparkles className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
