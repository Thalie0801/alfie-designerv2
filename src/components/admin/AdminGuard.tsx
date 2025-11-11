import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Role = 'user' | 'admin' | 'super_admin';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (alive) {
          setRole('user');
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const r = (error ? 'user' : (data?.role as Role | undefined)) ?? 'user';
      if (alive) {
        setRole(r);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return null; // ou un spinner
  if (role !== 'admin' && role !== 'super_admin') {
    return <div className="p-6 text-sm text-muted-foreground">Accès refusé.</div>;
  }
  return <>{children}</>;
}
