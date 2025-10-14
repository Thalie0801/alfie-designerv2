// Logger pour les générations (conformité RGPD - logs sobres)
import { supabase } from '@/integrations/supabase/client';
import { truncatePromptForLog } from '@/config/systemConfig';

export interface GenerationLogData {
  brandId: string | null;
  userId: string;
  type: 'image' | 'video';
  engine?: 'nano' | 'sora' | 'veo3';
  prompt: string;
  woofsCost?: number;
  status: 'success' | 'failed';
  durationSeconds?: number;
  errorCode?: string;
  metadata?: Record<string, any>;
}

/**
 * Log une génération dans la table generation_logs
 * Respecte la conformité RGPD avec prompts tronqués
 */
export async function logGeneration(data: GenerationLogData): Promise<void> {
  try {
    const { error } = await supabase
      .from('generation_logs')
      .insert({
        brand_id: data.brandId,
        user_id: data.userId,
        type: data.type,
        engine: data.engine,
        prompt_summary: truncatePromptForLog(data.prompt),
        woofs_cost: data.woofsCost || 0,
        status: data.status,
        duration_seconds: data.durationSeconds,
        error_code: data.errorCode,
        metadata: data.metadata || {}
      });

    if (error) {
      console.error('[LOGGER] Error logging generation:', error);
    }
  } catch (err) {
    console.error('[LOGGER] Exception logging generation:', err);
  }
}

/**
 * Récupère les logs de génération d'un utilisateur
 */
export async function getUserGenerationLogs(
  userId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('generation_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[LOGGER] Error fetching user logs:', err);
    return [];
  }
}

/**
 * Récupère les logs d'une marque
 */
export async function getBrandGenerationLogs(
  brandId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('generation_logs')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[LOGGER] Error fetching brand logs:', err);
    return [];
  }
}

/**
 * Statistiques basiques pour analytics V2.1
 */
export async function getBrandAnalytics(brandId: string): Promise<{
  totalGenerations: number;
  totalImages: number;
  totalVideos: number;
  soraCount: number;
  veo3Count: number;
  avgDurationSeconds: number;
  successRate: number;
}> {
  try {
    const { data, error } = await supabase
      .from('generation_logs')
      .select('*')
      .eq('brand_id', brandId)
      .gte('created_at', new Date(new Date().setDate(1)).toISOString()); // Ce mois

    if (error) throw error;
    
    const logs = data || [];
    const totalGenerations = logs.length;
    const totalImages = logs.filter(l => l.type === 'image').length;
    const totalVideos = logs.filter(l => l.type === 'video').length;
    const soraCount = logs.filter(l => l.engine === 'sora').length;
    const veo3Count = logs.filter(l => l.engine === 'veo3').length;
    const avgDurationSeconds = logs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0) / totalGenerations || 0;
    const successCount = logs.filter(l => l.status === 'success').length;
    const successRate = totalGenerations > 0 ? (successCount / totalGenerations) * 100 : 0;

    return {
      totalGenerations,
      totalImages,
      totalVideos,
      soraCount,
      veo3Count,
      avgDurationSeconds: Math.round(avgDurationSeconds),
      successRate: Math.round(successRate)
    };
  } catch (err) {
    console.error('[ANALYTICS] Error calculating brand analytics:', err);
    return {
      totalGenerations: 0,
      totalImages: 0,
      totalVideos: 0,
      soraCount: 0,
      veo3Count: 0,
      avgDurationSeconds: 0,
      successRate: 0
    };
  }
}
