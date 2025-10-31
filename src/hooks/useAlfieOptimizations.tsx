import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// Quotas mensuels par plan
const MONTHLY_QUOTAS = {
  none: 10,      // Plan gratuit: 10 requêtes/mois
  starter: 100,  // Plan Starter
  pro: 250,      // Plan Pro
  studio: 500,   // Plan Studio
};

export function useAlfieOptimizations() {
  const { profile } = useAuth();
  const [requestsThisMonth, setRequestsThisMonth] = useState(0);
  const [quota, setQuota] = useState(0);
  
  useEffect(() => {
    if (profile) {
      setRequestsThisMonth(profile.alfie_requests_this_month || 0);
      const userPlan = profile.plan || 'none';
      setQuota(MONTHLY_QUOTAS[userPlan as keyof typeof MONTHLY_QUOTAS] || 10);
    }
  }, [profile]);

  // Génère un hash simple du prompt pour le cache
  const hashPrompt = (prompt: string, type: string): string => {
    return `${type}:${prompt.toLowerCase().trim().replace(/\s+/g, ' ')}`;
  };

  // Vérifie si le quota est atteint
  // ⚠️ ANCIEN SYSTÈME DÉSACTIVÉ - On utilise get-quota (Woofs/Visuels) maintenant
  // Ce hook sert uniquement au tracking des stats Alfie
  const checkQuota = (): boolean => {
    console.log(`📊 Stats Alfie: ${requestsThisMonth}/${quota} requêtes ce mois`);
    return true; // Ne plus bloquer ici - seul get-quota contrôle les quotas
  };

  // Recherche dans le cache
  const getCachedResponse = async (prompt: string, type: string): Promise<any | null> => {
    try {
      const hash = hashPrompt(prompt, type);
      const { data, error } = await supabase
        .from('alfie_cache')
        .select('*')
        .eq('prompt_hash', hash)
        .maybeSingle();

      if (error) {
        console.error('Cache lookup error:', error);
        return null;
      }

      if (data) {
        // Incrémenter le compteur d'usage
        await supabase
          .from('alfie_cache')
          .update({ usage_count: (data.usage_count || 0) + 1 })
          .eq('id', data.id);

        console.log('✅ Cache HIT:', type, '(usage:', (data.usage_count || 0) + 1, ')');
        return data.response;
      }

      console.log('❌ Cache MISS:', type);
      return null;
    } catch (e) {
      console.error('Cache error:', e);
      return null;
    }
  };

  // Enregistre une réponse dans le cache
  const setCachedResponse = async (prompt: string, type: string, response: any): Promise<void> => {
    try {
      const hash = hashPrompt(prompt, type);
      await supabase.from('alfie_cache').upsert({
        prompt_hash: hash,
        prompt_type: type,
        response: response,
        usage_count: 1,
        updated_at: new Date().toISOString()
      }, { onConflict: 'prompt_hash' });

      console.log('💾 Cached:', type);
    } catch (e) {
      console.error('Cache save error:', e);
    }
  };

  // Incrémente le compteur de requêtes
  const incrementRequests = async (): Promise<boolean> => {
    if (!profile?.id) return false;
    
    try {
      const { data, error } = await supabase.rpc('increment_alfie_requests', {
        user_id_param: profile.id
      });

      if (error) throw error;

      setRequestsThisMonth(data);
      return true;
    } catch (e) {
      console.error('Failed to increment requests:', e);
      return false;
    }
  };

  return {
    checkQuota,
    getCachedResponse,
    setCachedResponse,
    incrementRequests,
    requestsThisMonth,
    quota,
    quotaPercentage: Math.round((requestsThisMonth / quota) * 100)
  };
}
