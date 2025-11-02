// ============================================
// AI Orchestrator - Fallback intelligent Gemini/OpenAI
// ============================================

export type AIProvider = 'gemini' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  endpoint: string;
}

export interface AgentContext {
  brandKit?: {
    name?: string;
    colors?: string[];
    palette?: any;
    fonts?: string[];
    voice?: string;
    style?: string;
    niche?: string;
  };
  conversationHistory?: any[];
  userMessage: string;
}

export interface AIResponse {
  choices: Array<{
    message: {
      content: string;
      tool_calls?: any[];
    };
  }>;
}

// Configuration des providers
export const AI_CONFIGS: Record<AIProvider, AIConfig> = {
  gemini: {
    provider: 'gemini',
    model: 'google/gemini-2.5-flash',
    endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions'
  },
  openai: {
    provider: 'openai',
    model: 'openai/gpt-4o',
    endpoint: 'https://ai.gateway.lovable.dev/v1/chat/completions'
  }
};

/**
 * Appelle l'IA avec fallback automatique Gemini → OpenAI
 */
export async function callAIWithFallback(
  messages: any[],
  context: AgentContext,
  tools?: any[],
  preferredProvider: AIProvider = 'gemini',
  iterationCount: number = 0
): Promise<AIResponse> {
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
  
  // Ordre de priorité des providers
  const providers = preferredProvider === 'gemini' 
    ? ['gemini' as AIProvider, 'openai' as AIProvider] 
    : ['openai' as AIProvider, 'gemini' as AIProvider];
  
  let lastError: Error | null = null;
  
  for (const provider of providers) {
    try {
      console.log(`[AI Orchestrator] Trying ${provider}...`);
      
      const config = AI_CONFIGS[provider];
      const enrichedMessages = buildMessagesForProvider(messages, context, provider);
      
      console.log(`[AI] Sending ${tools?.length || 0} tools to ${provider}`);
      
      // Pour OpenAI, forcer classify_intent en première itération
      let toolChoice: any = undefined;
      if (tools && tools.length > 0) {
        if (provider === 'openai' && iterationCount === 0) {
          // Forcer classify_intent en première itération pour OpenAI
          toolChoice = { type: "function", function: { name: "classify_intent" } };
          console.log('[AI] Forcing tool_choice: classify_intent (first iteration)');
        } else {
          toolChoice = "auto";
        }
      }
      
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          messages: enrichedMessages,
          tools: tools,
          tool_choice: toolChoice,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[AI Orchestrator] ${provider} failed (${response.status}): ${errorText}`);
        lastError = new Error(`${provider} failed: ${response.status}`);
        continue;
      }
      
      console.log(`[AI Orchestrator] ✅ Success with ${provider}`);
      const data = await response.json();
      return data as AIResponse;
      
    } catch (error) {
      console.error(`[AI Orchestrator] ${provider} error:`, error);
      lastError = error as Error;
    }
  }
  
  // Si tous les providers ont échoué
  throw new Error(`All AI providers failed. Last error: ${lastError?.message || 'Unknown'}`);
}

/**
 * Construit les messages selon le provider (prompts spécialisés)
 */
function buildMessagesForProvider(
  baseMessages: any[],
  context: AgentContext,
  provider: AIProvider
): any[] {
  
  const brandContext = buildBrandContext(context.brandKit);
  
  // System prompt spécialisé par provider
  let specialization = '';
  
  if (provider === 'gemini') {
    specialization = `
🎨 **SPÉCIALISATION GEMINI - Expert en création visuelle**

Tu es optimisé pour :
- Génération d'images ultra-détaillées avec Gemini NanoBanana
- Multimodal (image + texte)
- Cohérence de marque (Brand Kit)
- Composition visuelle professionnelle

**RÈGLES DE PROMPTING GEMINI:**
- Sois ULTRA-DESCRIPTIF : couleurs précises (HEX), composition détaillée, mood, lighting
- Intègre TOUJOURS le Brand Kit dans les visuels (couleurs, style, tone)
- Spécifie la hiérarchie visuelle et le contraste
- Pour carrousels : assure la cohérence visuelle entre slides

**EXEMPLE DE BON PROMPT GEMINI:**
"Professional product photography of sleek running shoes, dynamic 45° angle with motion blur effect, vibrant gradient background (#FF5733, #3498DB), studio lighting with soft rim shadows, high energy athletic mood, 8K quality, commercial advertising style"`;
  } else if (provider === 'openai') {
    specialization = `
🧠 **SPÉCIALISATION OPENAI - Expert en raisonnement structuré**

Tu es optimisé pour :
- Analyse complexe et raisonnement multi-étapes
- Structured outputs (JSON)
- Explications détaillées de choix créatifs
- Décomposition de demandes complexes

**RÈGLES DE RAISONNEMENT OPENAI:**
- Décompose les demandes complexes en étapes claires
- Fournis des EXPLICATIONS détaillées de tes choix (reasoning)
- Utilise le format JSON pour les structured outputs
- Justifie les décisions créatives par rapport au Brand Kit`;
  }
  
  // Injecter la spécialisation dans le premier message system
  const enrichedMessages = baseMessages.map((msg, index) => {
    if (index === 0 && msg.role === 'system') {
      return {
        ...msg,
        content: `${msg.content}

${brandContext}

${specialization}`
      };
    }
    return msg;
  });
  
  return enrichedMessages;
}

/**
 * Construit le contexte Brand Kit enrichi
 */
function buildBrandContext(brandKit?: AgentContext['brandKit']): string {
  if (!brandKit) {
    return '⚠️ **AUCUN BRAND KIT ACTIF** - Utilise un style générique professionnel.';
  }
  
  const colors = brandKit.colors || brandKit.palette || [];
  const fonts = brandKit.fonts || [];
  
  return `
📋 **BRAND KIT ACTIF:**

**Identité de marque:**
- Nom: ${brandKit.name || 'N/A'}
- Secteur/Niche: ${brandKit.niche || 'N/A'}

**Palette couleurs:**
${colors.length > 0 ? colors.map((c: any) => `  • ${typeof c === 'string' ? c : c.hex || c.value}`).join('\n') : '  • (Non définie)'}

**Typographie:**
${fonts.length > 0 ? fonts.map(f => `  • ${f}`).join('\n') : '  • (Non définie)'}

**Style visuel:**
- Esthétique: ${brandKit.style || 'moderne professionnel'}
- Ton de communication: ${brandKit.voice || 'professionnel'}

⚠️ **RÈGLE CRITIQUE:** Tous les visuels générés DOIVENT respecter ce Brand Kit (couleurs, style, tone).
`;
}

/**
 * Enrichit un prompt avec le Brand Kit pour génération visuelle
 */
export function enrichPromptWithBrandKit(
  basePrompt: string,
  brandKit?: AgentContext['brandKit']
): string {
  if (!brandKit) {
    return basePrompt;
  }
  
  const colors = brandKit.colors || brandKit.palette || [];
  const colorHex = colors.map((c: any) => typeof c === 'string' ? c : c.hex || c.value).filter(Boolean);
  
  return `${basePrompt}

**Style Guide Application:**
- Primary color palette: ${colorHex.join(', ') || 'professional neutral tones'}
- Visual aesthetic: ${brandKit.style || 'modern professional'}
- Mood/Tone: ${brandKit.voice || 'professional engaging'}
- Typography vibe: ${brandKit.fonts?.join(', ') || 'clean sans-serif'}
- Industry context: ${brandKit.niche || 'business'}

**Quality requirements:**
- High quality, professional grade
- Cohesive color scheme matching brand palette
- Consistent with brand visual identity
- Strong visual hierarchy and readability`;
}
