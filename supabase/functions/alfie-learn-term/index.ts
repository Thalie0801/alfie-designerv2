/**
 * Alfie Learn Term - Edge Function
 * Sauvegarde les termes personnalisés appris par Alfie dans alfie_memory
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

interface LearnedTerm {
  term: string;
  definition: string;
  template?: {
    kind?: string;
    count?: number;
    goal?: string;
    platform?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validation JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { brandId, term } = await req.json() as { brandId: string; term: LearnedTerm };

    if (!brandId || !term?.term || !term?.definition) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: brandId, term.term, term.definition" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Récupérer l'utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vérifier que l'utilisateur possède la marque
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("user_id")
      .eq("id", brandId)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: "Marque introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (brand.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Accès non autorisé à cette marque" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer ou créer l'entrée alfie_memory
    const { data: existingMemory, error: memoryError } = await supabase
      .from("alfie_memory")
      .select("id, custom_terms")
      .eq("user_id", user.id)
      .eq("brand_id", brandId)
      .maybeSingle();

    const termKey = term.term.toLowerCase().trim();
    const newTermData = {
      definition: term.definition,
      template: term.template || null,
      learned_at: new Date().toISOString(),
    };

    if (existingMemory) {
      // Mettre à jour les termes existants
      const currentTerms = (existingMemory.custom_terms as Record<string, any>) || {};
      const updatedTerms = {
        ...currentTerms,
        [termKey]: newTermData,
      };

      const { error: updateError } = await supabase
        .from("alfie_memory")
        .update({ 
          custom_terms: updatedTerms,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMemory.id);

      if (updateError) {
        console.error("Failed to update alfie_memory:", updateError);
        throw new Error("Erreur lors de la sauvegarde du terme");
      }
    } else {
      // Créer une nouvelle entrée alfie_memory
      const { error: insertError } = await supabase
        .from("alfie_memory")
        .insert({
          user_id: user.id,
          brand_id: brandId,
          custom_terms: { [termKey]: newTermData },
        });

      if (insertError) {
        console.error("Failed to insert alfie_memory:", insertError);
        throw new Error("Erreur lors de la création de la mémoire");
      }
    }

    console.log(`✅ Terme appris: "${termKey}" pour brand ${brandId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Terme "${term.term}" enregistré avec succès`,
        term: termKey,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("alfie-learn-term error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
