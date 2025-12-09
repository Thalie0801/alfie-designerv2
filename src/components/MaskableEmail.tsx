import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { maskEmailPartial } from '@/utils/privacy';
import { cn } from '@/lib/utils';

interface MaskableEmailProps {
  email: string;
  className?: string;
}

/**
 * Composant affichant un email masqué avec possibilité de révélation (admin)
 * Conforme RGPD - l'email est masqué par défaut
 */
export function MaskableEmail({ email, className }: MaskableEmailProps) {
  const [revealed, setRevealed] = useState(false);

  if (!email) return <span className={className}>-</span>;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 cursor-pointer hover:text-primary transition-colors",
        className
      )}
      onClick={() => setRevealed(!revealed)}
      title={revealed ? "Cliquer pour masquer" : "Cliquer pour révéler l'email complet"}
    >
      {revealed ? email : maskEmailPartial(email)}
      {revealed ? (
        <EyeOff className="h-3 w-3 opacity-50" />
      ) : (
        <Eye className="h-3 w-3 opacity-50" />
      )}
    </span>
  );
}
