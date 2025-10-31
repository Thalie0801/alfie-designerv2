import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SelectProviderRequest {
  brief: {
    use_case?: string;
    style?: string;
  };
  modality: "image" | "video";
  format: string;
  duration_s?: number;
  quality?: "draft" | "standard" | "premium";
  budget_woofs: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { brief, modality, format, duration_s = 10, quality = "standard", budget_woofs } =
      await req.json() as SelectProviderRequest;

    // Récupérer les providers disponibles
    const { data: providers, error: providersError } = await supabase
      .from("providers")
      .select("*")
      .eq("enabled", true)
      .contains("modalities", [modality])
      .contains("formats", [format]);

    if (providersError) throw providersError;
    if (!providers || providers.length === 0) {
      return new Response(
        JSON.stringify({
          decision: "KO",
          suggestions: ["Format non supporté", "Essayer un autre format"],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculer le score pour chaque provider avec bandit UCB
    const use_case = brief.use_case || 'general';
    
    // Get total trials for UCB calculation
    const { data: allMetrics } = await supabase
      .from('provider_metrics')
      .select('trials');
    
    const totalTrials = (allMetrics || []).reduce((sum: number, m: any) => sum + (m.trials || 0), 0);

    const candidates = await Promise.all(providers.map(async (p) => {
      const cost = estimateCost(p, modality, format, duration_s, quality);
      const qualityScore = p.quality_score as number;
      const latencyScore = 1 - Math.min((p.avg_latency_s as number) / 200, 1);
      const successScore = 1 - (p.fail_rate as number);

      // Poids selon qualité demandée
      let wQ = 0.3, wC = 0.3, wL = 0.2, wS = 0.2;
      if (quality === "premium") {
        wQ = 0.5; wC = 0.1; wL = 0.2; wS = 0.2;
      } else if (quality === "draft") {
        wQ = 0.1; wC = 0.4; wL = 0.4; wS = 0.1;
      }

      const normCost = Math.min(cost / budget_woofs, 2);
      let score = wQ * qualityScore - wC * normCost + wL * latencyScore + wS * successScore;

      // UCB bonus (bandit algorithm)
      const { data: metrics } = await supabase
        .from('provider_metrics')
        .select('trials, avg_reward')
        .eq('provider_id', p.id)
        .eq('use_case', use_case)
        .eq('format', format)
        .single();
      
      const trials = metrics?.trials || 0;
      const avgReward = metrics?.avg_reward || 0;
      const c = 1.5; // exploration parameter
      const ucbBonus = trials > 0 
        ? c * Math.sqrt(Math.log(totalTrials + 1) / trials)
        : c * 2; // High bonus for untried providers
      
      score = score + avgReward + ucbBonus;

      return { ...p, cost, score };
    }));

    const filteredCandidates = candidates.filter((c) => c.cost <= budget_woofs);

    if (filteredCandidates.length === 0) {
      return new Response(
        JSON.stringify({
          decision: "KO",
          suggestions: [
            `Budget insuffisant (${budget_woofs} woofs)`,
            duration_s > 10 ? `Réduire durée à ${Math.floor(budget_woofs * 5 / 2)}s` : "Réduire qualité à draft",
            format.includes("3840") ? "Passer en 1080p" : null,
          ].filter(Boolean),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Meilleur candidat
    const best = filteredCandidates.sort((a, b) => b.score - a.score)[0];

    return new Response(
      JSON.stringify({
        decision: "OK",
        provider: best.id,
        params: {
          duration: duration_s,
          resolution: format,
          style: brief.style || "standard",
          use_case: brief.use_case || "general",
        },
        cost_woofs: best.cost,
        eta_s: best.avg_latency_s,
        quality_score: best.quality_score,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function estimateCost(
  provider: any,
  modality: string,
  format: string,
  duration_s: number,
  quality: string
): number {
  const costJson = provider.cost_json;
  let cost = 0;

  if (modality === "image") {
    const base = costJson.base_per_image || 1;
    const hiRes = /3840x|4k|2048x/i.test(format) ? (costJson.hi_res_multiplier || 1.5) : 1;
    cost = Math.ceil(base * hiRes * (quality === "premium" ? 1.25 : 1));
  } else {
    const tier = /3840x|4k/i.test(format) ? "4k_per_5s" : "1080p_per_5s";
    const perChunk = costJson[tier] || costJson["1080p_per_5s"] || 2;
    cost = Math.ceil((duration_s / 5) * perChunk * (quality === "premium" ? 1.25 : 1));
  }

  return cost;
}
