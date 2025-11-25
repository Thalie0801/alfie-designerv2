import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { woofsForVideo } from '../_shared/woofs.ts';
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, validateEnv } from '../_shared/env.ts';

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error('Missing required environment variables', { missing: envValidation.missing });
}

interface SelectProviderRequest {
  brief: {
    use_case?: string;
    style?: string;
    quality_goal?: string;
  };
  modality: string;
  format: string;
  duration_s?: number;
  quality?: string;
  budget_woofs: number;
}

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ input }) => {
      const {
        brief,
        modality,
        format,
        duration_s = 10,
        quality = 'standard',
        budget_woofs,
      } = input as SelectProviderRequest;

      // ✅ client admin : pas de JWT ici, fonction interne
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

      // 1. Fetch enabled providers matching modality and format
      const { data: providers, error } = await supabase
        .from('providers')
        .select('*')
        .eq('enabled', true)
        .contains('modalities', [modality])
        .contains('formats', [format]);

      if (error || !providers || providers.length === 0) {
        return {
          decision: 'KO',
          reason: 'NO_PROVIDERS_AVAILABLE',
          suggestions: ['Try a different format or contact support'],
        };
      }

      // 2. Score providers
      const use_case = brief.use_case || 'general';
      
      const { data: allMetrics } = await supabase
        .from('provider_metrics')
        .select('trials');
      
      const totalTrials = (allMetrics || []).reduce((sum: number, m: any) => sum + (m.trials || 0), 0);

      const candidates = await Promise.all(providers.map(async (p: any) => {
        const cost = estimateCost(p, modality, format, duration_s, quality);
        const qualityScore = p.quality_score || 0.8;
        const latencyScore = 1 - Math.min((p.avg_latency_s || 60) / 200, 1);
        const successScore = 1 - (p.fail_rate || 0.03);

        let wQ = 0.3, wC = 0.3, wL = 0.2, wS = 0.2;
        if (quality === 'premium') {
          wQ = 0.5; wC = 0.1; wL = 0.2; wS = 0.2;
        } else if (quality === 'draft') {
          wQ = 0.1; wC = 0.4; wL = 0.4; wS = 0.1;
        }

        const normCost = Math.min(cost / budget_woofs, 2);
        let score = wQ * qualityScore - wC * normCost + wL * latencyScore + wS * successScore;

        const { data: metrics } = await supabase
          .from('provider_metrics')
          .select('trials, avg_reward')
          .eq('provider_id', p.id)
          .eq('use_case', use_case)
          .eq('format', format)
          .maybeSingle();
        
        const trials = metrics?.trials || 0;
        const avgReward = metrics?.avg_reward || 0;
        const c = 1.5;
        const ucbBonus = trials > 0 
          ? c * Math.sqrt(Math.log(totalTrials + 1) / trials)
          : c * 2;
        
        score = score + avgReward + ucbBonus;

        return { ...p, cost, score };
      }));

      const affordable = candidates.filter(c => c.cost <= budget_woofs);
      
      if (affordable.length === 0) {
        return {
          decision: 'KO',
          reason: 'INSUFFICIENT_BUDGET',
          min_cost: Math.min(...candidates.map(c => c.cost)),
          suggestions: ['Increase budget or reduce duration/quality'],
        };
      }

      const best = affordable.reduce((a, b) => a.score > b.score ? a : b);

      return {
        decision: 'OK',
        provider: best.id,
        params: { 
          duration: duration_s, 
          resolution: format, 
          style: brief.style || 'standard' 
        },
        cost_woofs: best.cost,
        eta_s: best.avg_latency_s,
        quality_score: best.quality_score,
      };
    });
  }
};

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
  } else if (modality === "video") {
    cost = woofsForVideo(duration_s);
  } else {
    cost = 0;
  }

  return cost;
}
