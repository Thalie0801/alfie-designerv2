import { useEffect } from 'react';
import { useAffiliate } from '@/hooks/useAffiliate';
import { toast } from 'sonner';
import { Users } from 'lucide-react';

export function AffiliateTracker() {
  const { affiliateRef, affiliateName } = useAffiliate();

  useEffect(() => {
    if (affiliateRef && affiliateName) {
      toast.success(`🎉 Bienvenue ! Invité par ${affiliateName}`, {
        duration: 5000,
        icon: <Users className="h-4 w-4" />,
      });
    }
  }, [affiliateRef, affiliateName]);

  return null;
}
