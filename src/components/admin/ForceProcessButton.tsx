import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useIsAdmin } from '@/hooks/useIsAdmin';

export function ForceProcessButton() {
  const isAdmin = useIsAdmin();
  const [loading, setLoading] = useState(false);

  if (isAdmin === null) return null;
  if (!isAdmin) return null;

  const handleForce = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('alfie-job-worker', {
        body: { force: true },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Failed to trigger worker');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleForce} disabled={loading}>
      {loading ? 'Traitement…' : 'Forcer le traitement'}
    </Button>
  );
}
