import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { CanvaIntegrationCard } from '@/components/integrations/CanvaIntegrationCard';

export default function Integrations() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const canvaStatus = params.get('canva');
    if (!canvaStatus) {
      return;
    }

    if (canvaStatus === 'success') {
      toast.success('Compte Canva connecté avec succès.');
    } else if (canvaStatus === 'error') {
      const reason = params.get('reason');
      const label = reason ? `(${reason})` : '';
      toast.error(`La connexion Canva a échoué ${label}`.trim());
    }

    params.delete('canva');
    params.delete('reason');
    const newSearch = params.toString();
    const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [location.pathname, location.search]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Intégrations</h1>
        <p className="text-muted-foreground">
          Centralisez toutes vos connexions pour alimenter Alfie (Canva, bientôt Meta, HubSpot...).
        </p>
      </div>

      <CanvaIntegrationCard />
    </div>
  );
}
