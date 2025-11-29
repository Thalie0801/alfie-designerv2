/**
 * Phase 5: Alfie Memory Hook
 * Manages user-specific generation preferences and defaults
 * Note: Uses raw queries until types are regenerated
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBrandKit } from './useBrandKit';
import type { UnifiedAlfieIntent } from '@/lib/types/alfie';

interface AlfieMemory {
  default_ratio: string;
  default_platform: string;
  default_tone: string | null;
  default_cta: string | null;
  default_slides: number;
  default_language: string;
  last_format: string | null;
  last_topic: string | null;
  preferred_goals: string[];
}

export function useAlfieMemory() {
  const { user } = useAuth();
  const { activeBrandId } = useBrandKit();
  const queryClient = useQueryClient();
  
  const { data: memory, isLoading } = useQuery({
    queryKey: ['alfie-memory', user?.id, activeBrandId],
    queryFn: async () => {
      if (!user?.id || !activeBrandId) return null;
      
      // Use raw query since types.ts doesn't have alfie_memory yet
      const { data, error } = await supabase
        .from('alfie_memory' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('brand_id', activeBrandId)
        .maybeSingle();
      
      if (error) throw error;
      return data as AlfieMemory | null;
    },
    enabled: !!user?.id && !!activeBrandId,
  });
  
  const updateMemory = useMutation({
    mutationFn: async (updates: Partial<AlfieMemory>) => {
      if (!user?.id || !activeBrandId) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('alfie_memory' as any)
        .upsert({
          user_id: user.id,
          brand_id: activeBrandId,
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alfie-memory'] });
    },
  });
  
  // Apply defaults to a partial intent
  const applyDefaults = (intent: Partial<UnifiedAlfieIntent>): UnifiedAlfieIntent => {
    return {
      id: intent.id || `intent_${Date.now()}`,
      brandId: intent.brandId || activeBrandId || '',
      kind: intent.kind || 'image',
      count: intent.count || memory?.default_slides || 5,
      platform: intent.platform || (memory?.default_platform as any) || 'instagram',
      ratio: intent.ratio || (memory?.default_ratio as any) || '4:5',
      title: intent.title || '',
      goal: intent.goal || (memory?.preferred_goals?.[0] as any) || 'engagement',
      tone: intent.tone || memory?.default_tone || 'professionnel',
      prompt: intent.prompt || '',
      useBrandKit: intent.useBrandKit ?? true,
      campaign: intent.campaign,
      copyBrief: intent.copyBrief,
      durationSeconds: intent.durationSeconds,
      referenceImageUrl: intent.referenceImageUrl,
      generatedTexts: intent.generatedTexts,
    };
  };
  
  return {
    memory,
    isLoading,
    updateMemory: updateMemory.mutate,
    applyDefaults,
  };
}
