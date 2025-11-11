import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (!mounted) return;
      setIsAdmin(Boolean(data?.is_admin) && !error);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return isAdmin;
}
