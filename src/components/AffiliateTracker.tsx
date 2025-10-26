import { useEffect } from 'react';
import { useAffiliate } from '@/hooks/useAffiliate';
import { toast } from 'sonner';
import { Users } from 'lucide-react';

export function AffiliateTracker() {
  const { affiliateRef, affiliateName } = useAffiliate();

  // Silent tracking - pas de toast intrusif
  useEffect(() => {
    if (affiliateRef && affiliateName) {
      console.log('Affiliate tracking:', affiliateName);
    }
  }, [affiliateRef, affiliateName]);

  return null;
}
