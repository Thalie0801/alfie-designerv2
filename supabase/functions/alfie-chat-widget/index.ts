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
 * ✅ FORCE MULTI-CLIPS : Si "CLIP 1..N" ou "X clips", GARANTIT N assets video_premium
 * Fonctionne même si pack est null ou contient 0/1 vidéo
 */
function forceMultiClips(pack: any, userMessage: string): any {
  if (!userMessage) return pack;
  
  // Détecter le pattern "CLIP X" dans le message utilisateur
  const clipMatches = userMessage.match(/CLIP\s*\d+/gi);
  const clipCount = clipMatches ? new Set(clipMatches.map(m => m.toUpperCase())).size : 0;
  
  // Alternative: détecter "X clips séparés" ou "générer X clips"
  const numericClipMatch = userMessage.match(/(\d+)\s*(clips?|vidéos?|reels?)\s*(séparés?|distincts?|différents?)?/i);
  const requestedCount = numericClipMatch ? parseInt(numericClipMatch[1], 10) : 0;
  
  const targetCount = Math.max(clipCount, requestedCount);
  
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
  
  // Extraire les infos de chaque clip depuis le message
  const clipInfos = extractClipInfos(userMessage, targetCount);
  
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
 * Extrait les informations de chaque clip depuis le message utilisateur
 */
function extractClipInfos(message: string, count: number): Array<{
  title: string;
  prompt: string;
  duration: number;
  overlayLines: string[];
}> {
  const infos: Array<{ title: string; prompt: string; duration: number; overlayLines: string[] }> = [];
  
  // Essayer de parser les blocs CLIP X
  const clipBlocks = message.split(/CLIP\s*\d+\s*[:\-–—]?\s*/i).filter(b => b.trim());
  
  for (let i = 0; i < count; i++) {
    const block = clipBlocks[i] || '';
    
    // Extraire la durée (ex: "2s", "3 sec")
    const durationMatch = block.match(/(\d+(?:\.\d+)?)\s*s(?:ec(?:ondes?)?)?/i);
    const duration = durationMatch ? Math.min(Math.max(parseFloat(durationMatch[1]), 1), 8) : 2;
    
    // Extraire le titre (ex: "Hook", "CTA", parenthèses)
    const titleMatch = block.match(/\(([^)]+)\)/);
    const title = titleMatch ? titleMatch[1].trim() : `Clip ${i + 1}`;
    
    // Extraire les textes entre guillemets pour overlayLines
    const textMatches = block.match(/["«"]([^"»"]+)["»"]/g) || [];
    const overlayLines = textMatches
      .map(t => t.replace(/["«»""]/g, '').trim())
      .filter(t => t.length > 0 && t.length < 50)
      .slice(0, 3); // Max 3 lignes par clip
    
    // Générer un prompt basé sur le contenu du bloc
    const cleanBlock = block
      .replace(/["«"]([^"»"]+)["»"]/g, '') // Retirer les guillemets
      .replace(/\(\d+(?:\.\d+)?s?\)/g, '') // Retirer les durées entre parenthèses
      .replace(/\d+(?:\.\d+)?\s*s(?:ec)?/gi, '') // Retirer les durées
      .trim();
    
    const prompt = cleanBlock.length > 10 
      ? cleanBlock.substring(0, 200) 
      : `${title} - animation dynamique`;
    
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
    
    let brandContext: { name?: string; niche?: string; voice?: string; palette?: string[]; logo_url?: string } | undefined;
    
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

        // ✅ Vérifier que l'utilisateur possède la brand + récupérer logo_url
        const brandResponse = await fetch(`${SUPABASE_URL}/rest/v1/brands?id=eq.${brandId}&select=user_id,name,niche,voice,palette,logo_url`, {
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
              logo_url: brands[0].logo_url, // ✅ NEW: Include logo_url
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
    pack = forceMultiClips(pack, lastUserMessage);
    
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
