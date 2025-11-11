import type { ReactNode } from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';

export function AdminGuard({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  if (isAdmin === null) return null;
  if (!isAdmin) return <div>Accès refusé.</div>;
  return <>{children}</>;
}
