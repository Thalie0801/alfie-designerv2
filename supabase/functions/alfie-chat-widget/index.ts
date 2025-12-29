/**
 * Alfie Chat Widget - Edge Function
 * Moteur principal : Lovable AI (Gemini 2.5 Flash)
 * Fallback/Future : Vertex AI (prêt à activer quand les secrets seront configurés)
 */

import { corsHeaders } from "../_shared/cors.ts";
import { callVertexChat } from "./vertexHelper.ts";
import { getModelsForPlan } from "../_shared/aiModels.ts";
import { paletteToDescriptions } from "../_shared/colorContrast.ts";
import { SYSTEM_PROMPT, getEnrichedPrompt } from "./systemPrompt.ts";

/**
 * Appelle le LLM (Lovable AI principal, Vertex AI en fallback/futur)
 */
async function callLLM(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  brandContext?: { name?: string; niche?: string; voice?: string; palette?: string[]; logo_url?: string },
  woofsRemaining?: number,
  useBrandKit: boolean = true,
  briefContext?: string,
  userPlan?: string,
  customTerms?: Record<string, { definition: string; template?: any }>
): Promise<string> {
  // ✅ Utiliser la fonction d'enrichissement du module externe
  const enrichedPrompt = getEnrichedPrompt(
    SYSTEM_PROMPT,
    useBrandKit,
    brandContext,
    woofsRemaining,
    briefContext,
    paletteToDescriptions,
    customTerms
  );

  // Détecter si le message utilisateur demande du contenu (carrousel, images, vidéo)
  const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';
  const isContentRequest = /(carrousel|carousel|image|images|visuel|vidéo|video|slides?|créer?|génère|fais-?moi|je veux)/i.test(lastUserMessage);
  const isConfirmation = /^(ok|oui|c'est bon|on y va|lance|parfait|go|d'accord|da)[\s!.,]*$/i.test(lastUserMessage.trim());

  console.log(`📝 User message analysis: isContentRequest=${isContentRequest}, isConfirmation=${isConfirmation}`);

  // 1. Essayer Vertex AI si configuré (avec retry si format invalide)
  const vertexConfigured = Deno.env.get("VERTEX_PROJECT_ID") && Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (vertexConfigured) {
    try {
      console.log("🎯 Using Vertex AI (Gemini)...");
      const vertexResponse = await callVertexChat(messages, enrichedPrompt);
      
      // ✅ Vérifier que la réponse contient un pack valide
      if (vertexResponse && vertexResponse.length > 100 && vertexResponse.includes("<alfie-pack>")) {
        console.log("✅ Vertex AI responded successfully with valid pack format");
        return vertexResponse;
      } else if (vertexResponse && vertexResponse.length > 100) {
        // Réponse longue mais sans pack
        const promisesPack = /(voici le pack|je te propose|voici ta|voilà le pack|prêt à générer)/i.test(vertexResponse);
        
        if (promisesPack || isContentRequest) {
          // La réponse promet un pack OU l'utilisateur demandait du contenu → RETRY
          console.warn("⚠️ Vertex AI response promises pack but missing <alfie-pack>, retrying...");
          
          const retryPrompt = enrichedPrompt + `\n\n⚠️ RAPPEL CRITIQUE FINAL : L'utilisateur attend un pack de génération. Tu DOIS ABSOLUMENT inclure un bloc <alfie-pack>{...JSON valide...}</alfie-pack> dans ta réponse. Sans ce bloc, rien ne sera généré et l'utilisateur verra une erreur.`;
          
          const retryResponse = await callVertexChat(messages, retryPrompt);
          
          if (retryResponse && retryResponse.includes("<alfie-pack>")) {
            console.log("✅ Retry succeeded with valid pack format");
            return retryResponse;
          } else {
            console.warn("⚠️ Retry also failed to include <alfie-pack>, falling back to Lovable AI");
          }
        } else {
          // Réponse conversationnelle normale (pas de demande de contenu)
          console.log("✅ Vertex AI conversational response (no pack expected)");
          return vertexResponse;
        }
      } else {
        console.warn("⚠️ Vertex AI returned empty/short response, falling back to Lovable AI");
      }
    } catch (error: any) {
      console.warn("⚠️ Vertex AI failed, falling back to Lovable AI:", error?.message || String(error));
    }
  }

  // 2. Lovable AI - Tous les plans utilisent maintenant le modèle Premium
  const models = getModelsForPlan(userPlan);
  console.log(`🔄 Using Lovable AI (Premium) - Model: ${models.text}`);
  
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    throw new Error("No LLM configured - missing LOVABLE_API_KEY");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: models.text, // ✅ Modèle dynamique selon le plan
      messages: [
        { role: "system", content: enrichedPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 4096, // ✅ Augmenté pour packs complexes (vidéos multi-plans)
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Lovable AI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const lovableResponse = data.choices?.[0]?.message?.content || "";

  // ✅ RETRY LOGIC pour Lovable AI aussi si demande contenu mais pas de pack
  const promisesPackLovable = /(voici le pack|je te propose|voici ta|voilà le pack|prêt à générer)/i.test(lovableResponse);
  
  if ((isContentRequest || promisesPackLovable) && !lovableResponse.includes("<alfie-pack>") && lovableResponse.length > 50) {
    console.warn("⚠️ Lovable AI response missing <alfie-pack> for content request, retrying...");
    
    const retryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: models.text,
        messages: [
          { role: "system", content: enrichedPrompt + `\n\n⚠️ RAPPEL CRITIQUE : Tu DOIS inclure un bloc <alfie-pack>{JSON}}</alfie-pack> pour que la génération fonctionne.` },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });
    
    if (retryResponse.ok) {
      const retryData = await retryResponse.json();
      const retryContent = retryData.choices?.[0]?.message?.content || "";
      if (retryContent.includes("<alfie-pack>")) {
        console.log("✅ Lovable AI retry succeeded with pack");
        return retryContent;
      }
    }
    console.warn("⚠️ Lovable AI retry also failed, returning original response");
  }
  
  return lovableResponse;
}

/**
 * Parse le bloc <alfie-pack>{...}</alfie-pack> depuis la réponse LLM
 * ✅ ULTRA-ROBUSTE : Tolère les JSON cassés, les newlines dans les strings, les balises manquantes
 */
function parsePack(text: string): any | null {
  // ✅ Normaliser les variantes de balise : <alfie-pack >, <ALFIE-PACK>, etc.
  let normalizedText = text;
  normalizedText = normalizedText.replace(/<alfie-pack\s*>/gi, '<alfie-pack>');
  normalizedText = normalizedText.replace(/<\/alfie-pack\s*>/gi, '</alfie-pack>');
  
  const startTag = '<alfie-pack>';
  const endTag = '</alfie-pack>';
  
  const startIdx = normalizedText.toLowerCase().indexOf(startTag.toLowerCase());
  if (startIdx === -1) {
    console.log("📦 No <alfie-pack> tag found in response");
    return null;
  }
  
  let endIdx = normalizedText.toLowerCase().indexOf(endTag.toLowerCase(), startIdx);
  let jsonContent: string;
  
  if (endIdx === -1 || endIdx <= startIdx) {
    // ✅ ROBUSTESSE : Balise fermante manquante → prendre jusqu'à la fin
    console.warn("📦 Found <alfie-pack> but missing closing tag, attempting recovery...");
    jsonContent = normalizedText.slice(startIdx + startTag.length).trim();
  } else {
    jsonContent = normalizedText.slice(startIdx + startTag.length, endIdx).trim();
  }
  
  // ✅ Nettoyer le JSON : retirer les backticks markdown
  if (jsonContent.startsWith('```json')) {
    jsonContent = jsonContent.slice(7);
  } else if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.slice(3);
  }
  if (jsonContent.endsWith('```')) {
    jsonContent = jsonContent.slice(0, -3);
  }
  jsonContent = jsonContent.trim();
  
  // ✅ Trouver le début du JSON si texte parasite
  const jsonStartIdx = jsonContent.indexOf('{');
  if (jsonStartIdx > 0) {
    console.log("📦 Cleaning preamble text before JSON");
    jsonContent = jsonContent.slice(jsonStartIdx);
  }
  
  // ✅ SANITIZATION : Remplacer les vraies newlines dans les strings JSON (cause #1 d'échec)
  // On remplace \r\n et \n par un espace (sauf ceux déjà échappés \\n)
  jsonContent = jsonContent.replace(/(?<!\\)\r?\n/g, ' ');
  
  // ✅ Nettoyer les espaces multiples
  jsonContent = jsonContent.replace(/\s+/g, ' ');
  
  try {
    const parsed = JSON.parse(jsonContent);
    console.log("📦 Pack parsed successfully, assets count:", parsed.assets?.length || 0);
    return parsed;
  } catch (error) {
    console.error("📦 First parse attempt failed:", error);
    console.error("📦 JSON preview (first 300 chars):", jsonContent.substring(0, 300));
    
    // ✅ Tentative 2 : Trouver la dernière accolade fermante valide
    const lastBrace = jsonContent.lastIndexOf('}');
    if (lastBrace > 0) {
      const truncatedJson = jsonContent.slice(0, lastBrace + 1);
      try {
        const parsed = JSON.parse(truncatedJson);
        console.log("📦 Pack parsed after truncation repair, assets count:", parsed.assets?.length || 0);
        return parsed;
      } catch (e2) {
        console.error("📦 Truncation repair also failed:", e2);
      }
    }
    
    // ✅ Tentative 3 : Extraire manuellement les champs essentiels (fallback ultime)
    try {
      const titleMatch = jsonContent.match(/"title"\s*:\s*"([^"]+)"/);
      const assetsMatch = jsonContent.match(/"assets"\s*:\s*\[/);
      if (titleMatch && assetsMatch) {
        console.log("📦 Attempting minimal pack extraction...");
        // Trouver le tableau assets
        const assetsStart = jsonContent.indexOf('"assets"');
        const bracketStart = jsonContent.indexOf('[', assetsStart);
        let bracketCount = 1;
        let bracketEnd = bracketStart + 1;
        while (bracketCount > 0 && bracketEnd < jsonContent.length) {
          if (jsonContent[bracketEnd] === '[') bracketCount++;
          if (jsonContent[bracketEnd] === ']') bracketCount--;
          bracketEnd++;
        }
        const assetsJson = jsonContent.slice(bracketStart, bracketEnd);
        const minimalPack = `{"title":"${titleMatch[1]}","summary":"","assets":${assetsJson}}`;
        const parsed = JSON.parse(minimalPack);
        console.log("📦 Minimal pack extraction succeeded, assets count:", parsed.assets?.length || 0);
        return parsed;
      }
    } catch (e3) {
      console.error("📦 Minimal extraction also failed");
    }
    
    return null;
  }
}

/**
 * ✅ FORCE MULTI-CLIPS : Si "CLIP 1..N" ou "X clips/assets/scènes", GARANTIT N assets video_premium
 * Fonctionne même si pack est null ou contient 0/1 vidéo
 * @param brandContext - Brand Kit du client pour enrichir les prompts (niche, palette, visual_types, voice)
 */
function forceMultiClips(
  pack: any, 
  userMessage: string,
  brandContext?: { niche?: string; palette?: string[] | any; visual_types?: string[]; voice?: string }
): any {
  if (!userMessage) return pack;
  
  const msg = userMessage.toLowerCase();
  
  // Pattern 1: "CLIP X" explicites dans le message
  const clipMatches = userMessage.match(/CLIP\s*\d+/gi);
  const clipCount = clipMatches ? new Set(clipMatches.map(m => m.toUpperCase())).size : 0;
  
  // Pattern 2: "X clips/vidéos/assets/scènes (séparés)?"
  const numericMatch = msg.match(/(\d+)\s*(clips?|vidéos?|reels?|assets?|scènes?|parties?)\s*(séparés?|distincts?|différents?)?/i);
  const numericCount = numericMatch ? parseInt(numericMatch[1], 10) : 0;
  
  // Pattern 3: INVERSÉ "vidéo de X assets" / "montage de X scènes" / "série de X clips"
  const inverseMatch = msg.match(/(vidéo|montage|série|pack)\s+de\s+(\d+)\s*(assets?|clips?|scènes?|parties?|vidéos?)/i);
  const inverseCount = inverseMatch ? parseInt(inverseMatch[2], 10) : 0;
  
  // Pattern 4: "créer/générer/faire X clips/assets"
  const createMatch = msg.match(/(créer?|génér|faire|produi)\w*\s+(\d+)\s*(clips?|vidéos?|assets?|scènes?)/i);
  const createCount = createMatch ? parseInt(createMatch[2], 10) : 0;
  
  // Pattern 5: "X clips/vidéos" en début de phrase
  const startMatch = msg.match(/^(\d+)\s*(clips?|vidéos?|assets?|scènes?)/i);
  const startCount = startMatch ? parseInt(startMatch[1], 10) : 0;
  
  const targetCount = Math.max(clipCount, numericCount, inverseCount, createCount, startCount);
  
  console.log(`🎬 MULTI-CLIPS DETECTION: clipCount=${clipCount}, numericCount=${numericCount}, inverseCount=${inverseCount}, createCount=${createCount}, startCount=${startCount} → target=${targetCount}`);
  
  if (targetCount <= 1) {
    // Pas de demande multi-clips détectée
    return pack;
  }
  
  // Compter les videos dans le pack actuel
  const currentVideos = pack?.assets?.filter((a: any) => a.kind === 'video_premium') || [];
  
  if (currentVideos.length === targetCount) {
    // Déjà le bon nombre → rien à faire
    console.log(`🎬 MULTI-CLIPS: Pack already has ${targetCount} videos, no change needed`);
    return pack;
  }
  
  console.log(`🎬 FORCE MULTI-CLIPS: Requested ${targetCount} clips, current=${currentVideos.length}, forcing creation...`);
  
  // Extraire les infos de chaque clip depuis le message (avec Brand Kit pour enrichissement)
  const clipInfos = extractClipInfos(userMessage, targetCount, brandContext);
  
  // Récupérer le template de l'asset vidéo existant (s'il y en a un)
  const templateAsset = currentVideos[0] || {};
  
  // Créer N assets distincts
  const scriptGroupId = `clips-${Date.now()}`;
  const newVideoAssets = clipInfos.map((info, idx) => ({
    id: `vid-${idx + 1}`,
    kind: 'video_premium' as const,
    title: info.title || `Clip ${idx + 1}`,
    prompt: info.prompt || templateAsset.prompt || `Clip ${idx + 1} - ${info.title}`,
    ratio: templateAsset.ratio || '9:16',
    platform: templateAsset.platform || 'instagram',
    goal: templateAsset.goal || 'engagement',
    tone: templateAsset.tone || 'dynamique',
    durationSeconds: info.duration || 2,
    postProdMode: true, // ✅ Toujours activer la post-prod
    overlayLines: info.overlayLines.length > 0 ? info.overlayLines : [],
    withAudio: true,
    scriptGroup: scriptGroupId, // Lier pour assemblage optionnel
    sceneOrder: idx + 1,
    woofCostType: 'video_premium' as const,
  }));
  
  // Construire ou mettre à jour le pack
  if (!pack) {
    pack = {
      title: `${targetCount} Clips Vidéo`,
      summary: `Pack de ${targetCount} clips séparés`,
      assets: newVideoAssets,
    };
  } else {
    // Remplacer les vidéos existantes par les N vidéos
    const otherAssets = pack.assets?.filter((a: any) => a.kind !== 'video_premium') || [];
    pack.assets = [...otherAssets, ...newVideoAssets];
  }
  
  console.log(`🎬 FORCE MULTI-CLIPS: Pack now has ${pack.assets.length} assets (${newVideoAssets.length} videos)`);
  
  return pack;
}

/**
 * Extrait les instructions globales du message utilisateur (STYLE, MASCOTTE, INTERDIT, TEXT LOCK)
 */
function extractGlobalInstructions(message: string): {
  style: string;
  character: string;
  rules: string[];
} {
  // Extraire le STYLE global (jusqu'au premier saut de ligne ou point)
  const styleMatch = message.match(/STYLE\s*:?\s*([^\n.]+(?:\.[^\n]+)?)/i);
  const style = styleMatch?.[1]?.trim() || '';
  
  // Extraire MASCOTTE ou CHARACTER
  const mascotteMatch = message.match(/MASCOTTE\s*:?\s*([^\n.]+)/i);
  const characterMatch = message.match(/CHARACTER\s*:?\s*([^\n.]+)/i);
  const character = (mascotteMatch?.[1] || characterMatch?.[1] || '').trim();
  
  // Extraire les règles (INTERDIT, TEXT LOCK, PROCESS)
  const rules: string[] = [];
  
  const interditMatch = message.match(/INTERDIT(?:\s+ABSOLU)?\s*:?\s*([^\n.]+)/i);
  if (interditMatch) rules.push(`FORBIDDEN: ${interditMatch[1].trim()}`);
  
  const textLockMatch = message.match(/TEXT\s*LOCK\s*:?\s*([^\n.]+)/i);
  if (textLockMatch) rules.push(`TEXT LOCK: ${textLockMatch[1].trim()}`);
  
  const processMatch = message.match(/PROCESS\s*:?\s*([^\n.]+)/i);
  if (processMatch) rules.push(`PROCESS: ${processMatch[1].trim()}`);
  
  return { style, character, rules };
}

/**
 * Construit un prompt enrichi avec le contenu du clip + instructions globales + Brand Kit
 * GÉNÉRIQUE : fonctionne pour tous les clients, pas juste pour un cas spécifique
 */
function buildEnrichedClipPrompt(
  clipContent: string,
  globalInstructions: { style: string; character: string; rules: string[] },
  brandKit?: { niche?: string; palette?: string[] | any; visual_types?: string[]; voice?: string }
): string {
  const parts: string[] = [];
  
  // ✅ CONTENU SPÉCIFIQUE DU CLIP (PAS DE TRONCATURE!)
  parts.push(clipContent.trim());
  
  // ✅ STYLE GLOBAL du message (si présent dans le prompt utilisateur)
  if (globalInstructions.style) {
    parts.push(`\nGLOBAL STYLE: ${globalInstructions.style}`);
  }
  
  // ✅ PERSONNAGE/MASCOTTE (si présent dans le prompt utilisateur)
  if (globalInstructions.character) {
    parts.push(`\nCHARACTER/MASCOT: ${globalInstructions.character}`);
  }
  
  // ✅ BRAND KIT (GÉNÉRIQUE - fonctionne pour tous les clients)
  if (brandKit) {
    if (brandKit.niche) {
      parts.push(`\nINDUSTRY CONTEXT: ${brandKit.niche}`);
    }
    
    // Palette de couleurs (peut être array ou objet)
    const paletteColors = Array.isArray(brandKit.palette) 
      ? brandKit.palette 
      : (brandKit.palette?.colors || []);
    if (paletteColors.length > 0) {
      parts.push(`\nBRAND COLORS: ${paletteColors.slice(0, 4).join(', ')}`);
    }
    
    // Visual types → déduire le style visuel
    if (brandKit.visual_types?.length) {
      const types = brandKit.visual_types;
      let styleHint = 'professional cinematic style';
      if (types.includes('3d_renders') || types.includes('3d')) {
        styleHint = '3D Pixar-style, smooth CGI rendering';
      } else if (types.includes('2d_illustrations') || types.includes('2d')) {
        styleHint = '2D animated illustration style, flat design';
      } else if (types.includes('photos') || types.includes('photo')) {
        styleHint = 'photorealistic, cinematic photography';
      } else if (types.includes('avatars_flat')) {
        styleHint = 'flat avatar style, minimalist';
      }
      parts.push(`\nVISUAL APPROACH: ${styleHint}`);
    }
    
    if (brandKit.voice) {
      parts.push(`\nTONE OF VOICE: ${brandKit.voice}`);
    }
  }
  
  // ✅ RÈGLES GLOBALES (INTERDIT, TEXT LOCK, PROCESS)
  if (globalInstructions.rules.length > 0) {
    parts.push(`\nRULES: ${globalInstructions.rules.join('. ')}`);
  }
  
  return parts.join('');
}

/**
 * Extrait les informations de chaque clip depuis le message utilisateur
 * Enrichit avec le Brand Kit du client pour un rendu personnalisé
 */
function extractClipInfos(
  message: string, 
  count: number,
  brandKit?: { niche?: string; palette?: string[] | any; visual_types?: string[]; voice?: string }
): Array<{
  title: string;
  prompt: string;
  duration: number;
  overlayLines: string[];
}> {
  const infos: Array<{ title: string; prompt: string; duration: number; overlayLines: string[] }> = [];
  
  // ✅ Extraire les instructions globales UNE SEULE FOIS
  const globalInstructions = extractGlobalInstructions(message);
  console.log('🎬 Global instructions extracted:', JSON.stringify(globalInstructions, null, 2));
  
  // Essayer de parser les blocs CLIP X
  const clipBlocks = message.split(/CLIP\s*\d+\s*[:\-–—]?\s*/i).filter(b => b.trim());
  
  for (let i = 0; i < count; i++) {
    const block = clipBlocks[i] || '';
    
    // Extraire la durée (ex: "8s", "8 secondes", "EXACTEMENT 8 secondes")
    const durationMatch = block.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:ondes?)?)?/i);
    const duration = durationMatch ? Math.min(Math.max(parseFloat(durationMatch[1]), 1), 8) : 8;
    
    // Extraire le titre (ex: "HOOK", "CTA", texte entre parenthèses après CLIP)
    const titleMatch = block.match(/^\s*[—–-]?\s*([A-Z]+(?:\s+\d+[-–]\d+)?)/);
    const parenMatch = block.match(/\(([^)]+)\)/);
    const title = titleMatch?.[1]?.trim() || parenMatch?.[1]?.trim() || `Clip ${i + 1}`;
    
    // Extraire les textes entre guillemets pour overlayLines
    const textMatches = block.match(/["«"]([^"»"]+)["»"]/g) || [];
    const overlayLines = textMatches
      .map(t => t.replace(/["«»""]/g, '').trim())
      .filter(t => t.length > 0 && t.length < 80) // ✅ Augmenté pour textes plus longs
      .slice(0, 5); // ✅ Max 5 lignes par clip
    
    // ✅ NOUVEAU: Construire le prompt COMPLET avec enrichissement Brand Kit
    const prompt = buildEnrichedClipPrompt(block, globalInstructions, brandKit);
    
    console.log(`🎬 Clip ${i + 1}: title="${title}", duration=${duration}s, overlayLines=${overlayLines.length}, promptLength=${prompt.length}`);
    
    infos.push({ title, prompt, duration, overlayLines });
  }
  
  return infos;
}

/**
 * Nettoie le texte en retirant le bloc <alfie-pack> et TOUS les astérisques markdown
 * Utilise indexOf/slice pour une extraction robuste (pas de regex)
 * ✅ Gère aussi les blocs tronqués (sans balise fermante)
 */
function cleanReply(text: string): string {
  let cleaned = text;
  
  // 1. Retirer le bloc <alfie-pack> avec indexOf/slice (robuste)
  const startTag = '<alfie-pack>';
  const endTag = '</alfie-pack>';
  const startIdx = cleaned.toLowerCase().indexOf(startTag.toLowerCase());
  if (startIdx !== -1) {
    const endIdx = cleaned.toLowerCase().indexOf(endTag.toLowerCase(), startIdx);
    if (endIdx !== -1) {
      // Cas normal : bloc complet avec balise fermante
      cleaned = cleaned.slice(0, startIdx) + cleaned.slice(endIdx + endTag.length);
    } else {
      // ✅ Balise fermante manquante (JSON tronqué) → supprimer depuis <alfie-pack> jusqu'à la fin
      cleaned = cleaned.slice(0, startIdx);
    }
  }
  
  // 2. Retirer markdown **gras** et *italique*
  cleaned = cleaned.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
  
  // 3. Remplacer les listes à puces markdown
  cleaned = cleaned.replace(/^\s*[-•*]\s+/gm, "");
  
  // 4. Retirer TOUTES les astérisques orphelines restantes
  cleaned = cleaned.replace(/\*/g, "");
  
  return cleaned.trim();
}

/**
 * Handler principal
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ VALIDATION JWT (activé dans config.toml)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { brandId, messages, lang, woofsRemaining, useBrandKit = true, brief, userPlan } = await req.json();

    if (!brandId || !messages) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brandId, messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer le Brand Kit COMPLET de la marque (palette, niche, voice, name)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    let brandContext: { name?: string; niche?: string; voice?: string; palette?: string[] | any; logo_url?: string; visual_types?: string[] } | undefined;
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        // ✅ VALIDATION PROPRIÉTÉ DE LA MARQUE
        const supabaseAuth = await import("https://esm.sh/@supabase/supabase-js@2.57.2").then(mod => mod.createClient);
        const supabase = supabaseAuth(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          return new Response(
            JSON.stringify({ error: "Token invalide" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // ✅ Vérifier que l'utilisateur possède la brand + récupérer logo_url, palette, visual_types
        const brandResponse = await fetch(`${SUPABASE_URL}/rest/v1/brands?id=eq.${brandId}&select=user_id,name,niche,voice,palette,logo_url,visual_types`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': authHeader
          }
        });
        
        if (brandResponse.ok) {
          const brands = await brandResponse.json();
          if (brands && brands.length > 0) {
            if (brands[0].user_id !== user.id) {
              return new Response(
                JSON.stringify({ error: "Accès non autorisé à cette marque" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            brandContext = {
              niche: brands[0].niche,
              voice: brands[0].voice,
              logo_url: brands[0].logo_url,
              palette: brands[0].palette, // ✅ NEW: Include palette for video prompts
              visual_types: brands[0].visual_types, // ✅ NEW: Include visual_types for style detection
            };
          } else {
            return new Response(
              JSON.stringify({ error: "Marque introuvable" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (error) {
        console.warn("Could not fetch brand context:", error);
      }
    }

    // ✅ Récupérer les termes personnalisés depuis alfie_memory
    let customTerms: Record<string, { definition: string; template?: any }> | undefined;
    if (SUPABASE_URL && SUPABASE_ANON_KEY && authHeader) {
      try {
        const memoryResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/alfie_memory?brand_id=eq.${brandId}&select=custom_terms`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': authHeader
            }
          }
        );
        
        if (memoryResponse.ok) {
          const memoryData = await memoryResponse.json();
          if (memoryData && memoryData.length > 0 && memoryData[0].custom_terms) {
            customTerms = memoryData[0].custom_terms;
            console.log("📚 Custom terms loaded:", Object.keys(customTerms || {}).length);
          }
        }
      } catch (error) {
        console.warn("Could not fetch custom terms:", error);
      }
    }

    // Ajouter le brief au contexte si fourni
    let briefContext = "";
    if (brief && Object.keys(brief).length > 0) {
      briefContext += `\n\n--- BRIEF DE CAMPAGNE (UTILISEZ CES INFORMATIONS) ---`;
      if (brief.platform) briefContext += `\nPlateforme cible : ${brief.platform}`;
      if (brief.format) briefContext += `\nFormat demandé : ${brief.format}`;
      if (brief.ratio) briefContext += `\nRatio : ${brief.ratio}`;
      if (brief.topic) briefContext += `\nSujet/Thème : ${brief.topic}`;
      if (brief.tone) briefContext += `\nTon souhaité : ${brief.tone}`;
      if (brief.cta) briefContext += `\nCall-to-action : ${brief.cta}`;
      if (brief.slides) briefContext += `\nNombre de slides : ${brief.slides}`;
      if (brief.goal) briefContext += `\nObjectif : ${brief.goal}`;
      if (brief.niche) briefContext += `\nNiche/Secteur : ${brief.niche}`;
      if (brief.audience) briefContext += `\nAudience cible : ${brief.audience}`;
      briefContext += `\n\nIMPORTANT : Utilise TOUTES ces informations du brief pour générer le pack. Ne redemande PAS ce qui est déjà renseigné ci-dessus.`;
    }

    // Appeler le LLM avec le system prompt unique, le plan utilisateur et les termes personnalisés
    const rawReply = await callLLM(messages, SYSTEM_PROMPT, brandContext, woofsRemaining, useBrandKit, briefContext, userPlan, customTerms);

    // Parser le pack si présent
    let pack = parsePack(rawReply);
    const reply = cleanReply(rawReply);
    
    // ✅ FORCE MULTI-CLIPS: Garantir N vidéos si "CLIP 1..N" même si pack null/incomplet
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
    pack = forceMultiClips(pack, lastUserMessage, brandContext);
    
    // ✅ Log de debug enrichi pour diagnostic
    const hasPackTag = rawReply.toLowerCase().includes('<alfie-pack>');
    console.log("📦 Pack result:", pack ? `assets=${pack.assets?.length || 0}` : "null", 
      "| hasTag:", hasPackTag, 
      "| rawReplyLength:", rawReply.length);
    
    if (hasPackTag && !pack) {
      console.error("📦 CRITICAL: Found <alfie-pack> tag but parsing failed!");
      console.error("📦 Raw reply preview:", rawReply.substring(0, 1000));
    }

    // ✅ Retourner rawReply pour fallback parsing côté frontend
    return new Response(
      JSON.stringify({ reply, pack, rawReply }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("alfie-chat-widget error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
