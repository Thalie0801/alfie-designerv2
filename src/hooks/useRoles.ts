import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Role = 'user' | 'admin' | 'super_admin';

type RolesState = {
  isAdmin: boolean;
  role?: Role;
  loading: boolean;
};

const ADMIN_ROLES: Role[] = ['admin', 'super_admin'];

export function useRoles(): RolesState {
  const [state, setState] = useState<RolesState>({ isAdmin: false, loading: true });

  useEffect(() => {
    let alive = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (alive) {
          setState({ isAdmin: false, loading: false });
        }
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const rawRole = (data?.role ?? 'user') as Role | string;
      const isValidRole = (value: string): value is Role =>
        value === 'user' || value === 'admin' || value === 'super_admin';
      const role: Role = !error && isValidRole(rawRole) ? rawRole : 'user';

      if (alive) {
        setState({
          role,
          isAdmin: ADMIN_ROLES.includes(role),
          loading: false,
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return state;
}
