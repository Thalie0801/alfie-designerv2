import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useUserBadges(userId?: string) {
  const [badges, setBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!userId) {
      setBadges([]);
      setLoading(false);
      return;
    }
    
    const fetchBadges = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching badges:', error);
        setBadges([]);
      } else {
        setBadges(data?.map(b => b.badge) || []);
      }
      setLoading(false);
    };
    
    fetchBadges();
  }, [userId]);
  
  return { 
    badges, 
    loading,
    isAmbassadeur: badges.includes('ambassadeur') 
  };
}
