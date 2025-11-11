import type { ReactNode } from 'react';
import { useRoles } from '@/hooks/useRoles';

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useRoles();

  if (loading) {
    return null;
  }

  if (!isAdmin) {
    return <div>Accès refusé.</div>;
  }

  return <>{children}</>;
}
