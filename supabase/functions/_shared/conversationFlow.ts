// Gestion du workflow conversationnel Alfie

export type ConversationState = 
  | 'initial'
  | 'collecting_order_size'
  | 'collecting_image_brief'
  | 'collecting_carousel_brief'
  | 'confirming'
  | 'generating'
  | 'completed';

export interface ConversationContext {
  numImages?: number;
  numCarousels?: number;
  currentImageIndex?: number;
  currentCarouselIndex?: number;
  imageBriefs?: any[];
  carouselBriefs?: any[];
  globalStyle?: string;
  campaign?: string;
}

export interface BriefQuestion {
  key: string;
  question: string;
  type: 'text' | 'select' | 'multi-select';
  options?: string[];
  required: boolean;
}

export const IMAGE_BRIEF_QUESTIONS: BriefQuestion[] = [
  {
    key: 'objective',
    question: 'Quel est l\'objectif de cette image ? (ex: acquisition, conversion, awareness)',
    type: 'text',
    required: true
  },
  {
    key: 'format',
    question: 'Quel format souhaitez-vous ? (1:1, 4:5, 9:16)',
    type: 'select',
    options: ['1:1', '4:5', '9:16', '16:9'],
    required: true
  },
  {
    key: 'style',
    question: 'Quel style visuel préférez-vous ? (ex: minimaliste, vibrant, professionnel)',
    type: 'text',
    required: false
  },
  {
    key: 'cta',
    question: 'Quel est votre appel à l\'action ? (ex: Découvrir, Acheter, S\'inscrire)',
    type: 'text',
    required: false
  }
];

export const CAROUSEL_BRIEF_QUESTIONS: BriefQuestion[] = [
  {
    key: 'topic',
    question: 'Quel est le sujet de ce carrousel ?',
    type: 'text',
    required: true
  },
  {
    key: 'angle',
    question: 'Quel angle souhaitez-vous ? (éducatif, promo, témoignage, storytelling)',
    type: 'select',
    options: ['éducatif', 'promo', 'témoignage', 'storytelling'],
    required: true
  },
  {
    key: 'numSlides',
    question: 'Combien de slides ? (recommandé: 5-8)',
    type: 'text',
    required: true
  },
  {
    key: 'format',
    question: 'Quel format ? (1080x1350 IG recommandé)',
    type: 'select',
    options: ['1:1', '4:5', '9:16'],
    required: false
  }
];

export function detectOrderIntent(message: string): { numImages: number; numCarousels: number } | null {
  const normalized = message.toLowerCase();
  
  // Patterns pour détecter les quantités
  const imagePattern = /(\d+)\s*(image|visuel|photo)/i;
  const carouselPattern = /(\d+)\s*(carrousel|carousel)/i;
  
  const imageMatch = normalized.match(imagePattern);
  const carouselMatch = normalized.match(carouselPattern);
  
  if (imageMatch || carouselMatch) {
    return {
      numImages: imageMatch ? parseInt(imageMatch[1]) : 0,
      numCarousels: carouselMatch ? parseInt(carouselMatch[1]) : 0
    };
  }
  
  return null;
}

// ✅ NEW: AI-powered topic detection using Lovable AI
export async function detectTopicIntent(userMessage: string): Promise<{
  topic: string;
  angle?: string;
  confidence: number;
}> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.warn('[detectTopicIntent] No LOVABLE_API_KEY, falling back to basic extraction');
    return { topic: userMessage, confidence: 0.5 };
  }

  try {
    const systemPrompt = `Tu es un expert en analyse de sujets marketing. Extrait le sujet principal et l'angle suggéré d'un message utilisateur.
    
Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "topic": "sujet principal détecté",
  "angle": "éducatif|promo|storytelling|null",
  "confidence": 0.0-1.0
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyse ce message : "${userMessage}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_topic",
              description: "Extrait le sujet et l'angle d'un message marketing",
              parameters: {
                type: "object",
                properties: {
                  topic: { type: "string", description: "Le sujet principal" },
                  angle: { type: "string", enum: ["éducatif", "promo", "storytelling", null] },
                  confidence: { type: "number", minimum: 0, maximum: 1 }
                },
                required: ["topic", "confidence"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_topic" } }
      }),
    });

    if (!response.ok) {
      console.error('[detectTopicIntent] AI error:', response.status);
      return { topic: userMessage, confidence: 0.5 };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall && toolCall.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      console.log('[detectTopicIntent] ✅ Detected:', result);
      return {
        topic: result.topic || userMessage,
        angle: result.angle || undefined,
        confidence: result.confidence || 0.5
      };
    }

    return { topic: userMessage, confidence: 0.5 };
  } catch (error) {
    console.error('[detectTopicIntent] Error:', error);
    return { topic: userMessage, confidence: 0.5 };
  }
}

export function validateResponse(question: BriefQuestion, response: string): { valid: boolean; error?: string } {
  if (question.required && !response.trim()) {
    return { valid: false, error: 'Cette réponse est obligatoire' };
  }
  
  if (question.type === 'select' && question.options) {
    const normalized = response.toLowerCase();
    const match = question.options.some(opt => normalized.includes(opt.toLowerCase()));
    if (!match) {
      return { valid: false, error: `Choisis parmi: ${question.options.join(', ')}` };
    }
  }
  
  return { valid: true };
}

export function extractResponseValue(question: BriefQuestion, response: string): any {
  const normalized = response.toLowerCase().trim();
  
  if (question.type === 'select' && question.options) {
    // Trouver l'option qui correspond
    const match = question.options.find(opt => normalized.includes(opt.toLowerCase()));
    return match || normalized;
  }
  
  // Pour numSlides, extraire le nombre
  if (question.key === 'numSlides') {
    const match = response.match(/(\d+)/);
    return match ? parseInt(match[1]) : 5;
  }
  
  return response.trim();
}

export function isSkipResponse(response: string): boolean {
  const normalized = response.toLowerCase();
  return ['skip', 'passe', 'suivant', 'next', 'non', 'rien'].some(word => normalized === word);
}

export function getNextQuestion(
  state: ConversationState,
  context: ConversationContext
): { question: string; quickReplies?: string[]; questionKey?: string } | null {
  
  if (state === 'initial') {
    return {
      question: "👋 Bonjour ! Je suis Alfie, votre assistant créatif. Combien d'images et de carrousels souhaitez-vous créer aujourd'hui ?",
      quickReplies: ['3 images', '2 carrousels', '1 image + 1 carrousel']
    };
  }
  
  if (state === 'collecting_image_brief' && context.numImages) {
    const currentIndex = context.currentImageIndex || 0;
    if (currentIndex < context.numImages) {
      const briefs = context.imageBriefs || [];
      const currentBrief = briefs[currentIndex] || {};
      
      // Progression dans les questions
      if (!currentBrief.objective) {
        return {
          question: `📸 Image ${currentIndex + 1}/${context.numImages}: Quel est l'objectif ? (acquisition, conversion, awareness)`,
          quickReplies: ['Acquisition', 'Conversion', 'Awareness'],
          questionKey: 'objective'
        };
      }
      if (!currentBrief.format) {
        return {
          question: `Image ${currentIndex + 1}: Quel format ?`,
          quickReplies: ['1:1 (Instagram post)', '4:5 (Instagram feed)', '9:16 (Stories)'],
          questionKey: 'format'
        };
      }
      if (!currentBrief.style) {
        return {
          question: `Image ${currentIndex + 1}: Quel style visuel ? (ou tape "skip" pour utiliser le style de ta marque)`,
          quickReplies: ['Minimaliste', 'Vibrant', 'Professionnel', 'Skip'],
          questionKey: 'style'
        };
      }
      // Brief complet pour cette image, passer à la suivante
      context.currentImageIndex = currentIndex + 1;
      return getNextQuestion(state, context);
    }
  }
  
  if (state === 'collecting_carousel_brief' && context.numCarousels) {
    const currentIndex = context.currentCarouselIndex || 0;
    if (currentIndex < context.numCarousels) {
      const briefs = context.carouselBriefs || [];
      const currentBrief = briefs[currentIndex] || {};
      
      if (!currentBrief.topic) {
        return {
          question: `🎠 Carrousel ${currentIndex + 1}/${context.numCarousels}: Quel est le sujet ? (décris-le librement)`,
          quickReplies: [], // ✅ REMOVED hardcoded choices - let user type freely
          questionKey: 'topic'
        };
      }
      if (!currentBrief.angle) {
        return {
          question: `Carrousel ${currentIndex + 1}: Quel angle ?`,
          quickReplies: ['Éducatif', 'Promo', 'Storytelling'],
          questionKey: 'angle'
        };
      }
      if (!currentBrief.numSlides) {
        return {
          question: `Carrousel ${currentIndex + 1}: Combien de slides ? (recommandé: 5-8)`,
          quickReplies: ['5 slides', '7 slides', '8 slides'],
          questionKey: 'numSlides'
        };
      }
      // Brief complet pour ce carrousel
      context.currentCarouselIndex = currentIndex + 1;
      return getNextQuestion(state, context);
    }
  }
  
  if (state === 'confirming') {
    return {
      question: buildSummary(context) + '\n\n✅ Tout est bon ? Je lance la génération ?',
      quickReplies: ['Oui, lance !', 'Modifier']
    };
  }
  
  return null;
}

export function buildSummary(context: ConversationContext): string {
  let summary = '📋 **Récapitulatif de votre commande:**\n\n';
  
  if (context.numImages && context.numImages > 0) {
    summary += `🖼️ **${context.numImages} image(s)**\n`;
    context.imageBriefs?.forEach((brief, idx) => {
      summary += `  ${idx + 1}. ${brief.objective || 'Non spécifié'} - Format: ${brief.format || '1:1'}\n`;
    });
  }
  
  if (context.numCarousels && context.numCarousels > 0) {
    summary += `\n📑 **${context.numCarousels} carrousel(s)**\n`;
    
    // ✅ Group carousels by (topic + angle + numSlides) to avoid duplicate display
    const grouped = new Map<string, { brief: any; indices: number[] }>();
    
    context.carouselBriefs?.forEach((brief, idx) => {
      const key = `${(brief.topic || 'n/a').toLowerCase()}|${(brief.angle || 'n/a').toLowerCase()}|${brief.numSlides || 5}`;
      
      if (grouped.has(key)) {
        grouped.get(key)!.indices.push(idx + 1);
      } else {
        grouped.set(key, { brief, indices: [idx + 1] });
      }
    });
    
    // Display with variant labels
    Array.from(grouped.values()).forEach(({ brief, indices }) => {
      const variantLabel = indices.length > 1 
        ? ` (${indices.length} variantes: #${indices.join(', #')})`
        : ` (#${indices[0]})`;
      
      summary += `  • ${brief.topic || 'Sujet libre'}${variantLabel}\n`;
      summary += `    Angle: ${brief.angle || 'N/A'} • ${brief.numSlides || 5} slides\n`;
    });
  }
  
  summary += `\n🎨 Style global: ${context.globalStyle || 'Style de votre marque'}\n`;
  
  return summary;
}

export function shouldTransitionState(
  currentState: ConversationState,
  context: ConversationContext,
  message: string
): ConversationState | null {
  
  // De initial à collecting_order_size
  if (currentState === 'initial') {
    const intent = detectOrderIntent(message);
    if (intent) {
      return 'collecting_order_size';
    }
  }
  
  // De collecting_order_size vers image ou carousel brief
  if (currentState === 'collecting_order_size') {
    if (context.numImages && context.numImages > 0) {
      return 'collecting_image_brief';
    } else if (context.numCarousels && context.numCarousels > 0) {
      return 'collecting_carousel_brief';
    }
  }
  
  // De image brief vers carousel brief ou confirming
  if (currentState === 'collecting_image_brief') {
    const currentIndex = context.currentImageIndex || 0;
    if (currentIndex >= (context.numImages || 0)) {
      if (context.numCarousels && context.numCarousels > 0) {
        return 'collecting_carousel_brief';
      }
      return 'confirming';
    }
  }
  
  // De carousel brief vers confirming
  if (currentState === 'collecting_carousel_brief') {
    const currentIndex = context.currentCarouselIndex || 0;
    if (currentIndex >= (context.numCarousels || 0)) {
      return 'confirming';
    }
  }
  
  // De confirming vers generating
  if (currentState === 'confirming') {
    const normalized = message.toLowerCase();
    if (normalized.includes('oui') || normalized.includes('confirmer') || normalized.includes('générer')) {
      return 'generating';
    }
  }
  
  return null;
}
