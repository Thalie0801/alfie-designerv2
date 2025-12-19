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
  userPlan?: string
): Promise<string> {
  // ✅ Utiliser la fonction d'enrichissement du module externe
  const enrichedPrompt = getEnrichedPrompt(
    SYSTEM_PROMPT,
    useBrandKit,
    brandContext,
    woofsRemaining,
    briefContext,
    paletteToDescriptions
  );

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
        // Réponse longue mais sans pack - RETRY avec instruction plus stricte
        console.warn("⚠️ Vertex AI response without <alfie-pack>, attempting retry with stricter prompt...");
        
        const retryPrompt = enrichedPrompt + `\n\n⚠️ RAPPEL CRITIQUE FINAL : Tu DOIS ABSOLUMENT terminer ta réponse avec un bloc <alfie-pack>{...JSON valide...}</alfie-pack>. C'est OBLIGATOIRE pour que la génération fonctionne. Sans ce bloc, l'utilisateur verra une erreur.`;
        
        const retryResponse = await callVertexChat(messages, retryPrompt);
        
        if (retryResponse && retryResponse.includes("<alfie-pack>")) {
          console.log("✅ Retry succeeded with valid pack format");
          return retryResponse;
        } else {
          console.warn("⚠️ Retry also failed to include <alfie-pack>, falling back to Lovable AI");
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
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Parse le bloc <alfie-pack>{...}</alfie-pack> depuis la réponse LLM
 * Utilise indexOf/slice au lieu de regex pour un parsing robuste du JSON imbriqué
 */
function parsePack(text: string): any | null {
  const startTag = '<alfie-pack>';
  const endTag = '</alfie-pack>';
  
  const startIdx = text.toLowerCase().indexOf(startTag.toLowerCase());
  if (startIdx === -1) return null;
  
  const endIdx = text.toLowerCase().indexOf(endTag.toLowerCase(), startIdx);
  if (endIdx === -1 || endIdx <= startIdx) return null;
  
  const jsonContent = text.slice(startIdx + startTag.length, endIdx).trim();
  
  try {
    const parsed = JSON.parse(jsonContent);
    console.log("📦 Pack parsed successfully, assets count:", parsed.assets?.length || 0);
    return parsed;
  } catch (error) {
    console.error("Failed to parse alfie-pack JSON:", error, "Content preview:", jsonContent.substring(0, 300));
    return null;
  }
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

    // Appeler le LLM avec le system prompt unique et le plan utilisateur
    const rawReply = await callLLM(messages, SYSTEM_PROMPT, brandContext, woofsRemaining, useBrandKit, briefContext, userPlan);

    // Parser le pack si présent
    const pack = parsePack(rawReply);
    const reply = cleanReply(rawReply);
    
    // Log de debug pour vérifier le parsing
    console.log("📦 Pack result:", pack ? `assets=${pack.assets?.length || 0}` : "null");

    return new Response(
      JSON.stringify({ reply, pack }),
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
