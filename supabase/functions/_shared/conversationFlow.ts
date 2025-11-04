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

export function getNextQuestion(
  state: ConversationState,
  context: ConversationContext
): { question: string; quickReplies?: string[] } | null {
  
  if (state === 'initial') {
    return {
      question: "👋 Bonjour ! Je suis Alfie, votre assistant créatif. Combien d'images et de carrousels souhaitez-vous créer aujourd'hui ?",
      quickReplies: ['3 images', '2 carrousels de 5 slides', '3 images + 2 carrousels']
    };
  }
  
  if (state === 'collecting_image_brief' && context.numImages) {
    const currentIndex = context.currentImageIndex || 0;
    if (currentIndex < context.numImages) {
      return {
        question: `📸 Image ${currentIndex + 1}/${context.numImages}: ${IMAGE_BRIEF_QUESTIONS[0].question}`,
        quickReplies: ['Acquisition', 'Conversion', 'Awareness']
      };
    }
  }
  
  if (state === 'collecting_carousel_brief' && context.numCarousels) {
    const currentIndex = context.currentCarouselIndex || 0;
    if (currentIndex < context.numCarousels) {
      return {
        question: `🎠 Carrousel ${currentIndex + 1}/${context.numCarousels}: ${CAROUSEL_BRIEF_QUESTIONS[0].question}`,
        quickReplies: ['Bénéfices produit', 'Témoignages clients', 'Tutoriel']
      };
    }
  }
  
  if (state === 'confirming') {
    return {
      question: '✅ Parfait ! Je récapitule votre commande. Confirmez-vous ?',
      quickReplies: ['Oui, générer !', 'Modifier']
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
    context.carouselBriefs?.forEach((brief, idx) => {
      summary += `  ${idx + 1}. ${brief.topic || 'Non spécifié'} - ${brief.numSlides || 5} slides - Angle: ${brief.angle || 'éducatif'}\n`;
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
