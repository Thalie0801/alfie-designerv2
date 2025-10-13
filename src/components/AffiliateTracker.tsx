import { useAffiliate } from '@/hooks/useAffiliate';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

export function AffiliateTracker() {
  const { affiliateRef, affiliateName } = useAffiliate();

  if (!affiliateRef || !affiliateName) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary/10 to-accent/10 border-b border-primary/20 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2">
        <Badge variant="secondary" className="gap-1.5">
          <Users className="h-3 w-3" />
          Invité par {affiliateName}
        </Badge>
        <span className="text-sm text-muted-foreground">
          🎉 Bienvenue !
        </span>
      </div>
    </div>
  );
}
