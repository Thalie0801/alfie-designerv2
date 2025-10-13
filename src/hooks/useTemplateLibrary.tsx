import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TemplateSearchParams {
  category?: string;
  keywords?: string;
  ratio?: string;
  limit?: number;
}

export interface CanvaTemplate {
  id: string;
  title: string;
  image_url: string;
  canva_url: string;
  description?: string;
  category?: string;
  fit_score?: number;
}

export function useTemplateLibrary() {
  const [loading, setLoading] = useState(false);

  const searchTemplates = async (params: TemplateSearchParams): Promise<CanvaTemplate[]> => {
    setLoading(true);
    try {
      let query = supabase
        .from('canva_designs')
        .select('*')
        .order('created_at', { ascending: false });

      if (params.category && params.category !== 'all') {
        query = query.eq('category', params.category);
      }

      if (params.keywords) {
        query = query.or(`title.ilike.%${params.keywords}%,description.ilike.%${params.keywords}%`);
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate fit scores based on search relevance
      const templatesWithScores = (data || []).map((template, index) => ({
        ...template,
        fit_score: Math.max(70, 95 - (index * 5)) // Simple scoring
      }));

      return templatesWithScores;
    } catch (error) {
      console.error('Error searching templates:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    searchTemplates,
    loading
  };
}
