import { useSubjectPacks } from '@/hooks/useSubjectPacks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Package, Sparkles, Dog } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubjectPackSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  brandId?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const PACK_TYPE_ICONS: Record<string, React.ReactNode> = {
  person: <User className="h-4 w-4" />,
  mascot: <Dog className="h-4 w-4" />,
  product: <Package className="h-4 w-4" />,
  object: <Sparkles className="h-4 w-4" />,
};

const PACK_TYPE_LABELS: Record<string, string> = {
  person: 'Personnage',
  mascot: 'Mascotte',
  product: 'Produit',
  object: 'Objet',
};

export function SubjectPackSelector({
  value,
  onChange,
  brandId,
  placeholder = "Sélectionner un Subject Pack",
  className,
  disabled = false,
}: SubjectPackSelectorProps) {
  const { packs, loading } = useSubjectPacks(brandId);

  return (
    <Select
      value={value || 'none'}
      onValueChange={(v) => onChange(v === 'none' ? null : v)}
      disabled={disabled || loading}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={loading ? "Chargement..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Aucun subject</span>
          </div>
        </SelectItem>
        
        {packs.map((pack) => (
          <SelectItem key={pack.id} value={pack.id}>
            <div className="flex items-center gap-3">
              {/* Thumbnail */}
              <div className="h-8 w-8 rounded overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={pack.master_image_url}
                  alt={pack.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              </div>
              {/* Info */}
              <div className="flex flex-col">
                <span className="font-medium text-sm">{pack.name}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {PACK_TYPE_ICONS[pack.pack_type]}
                  {PACK_TYPE_LABELS[pack.pack_type]}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}

        {!loading && packs.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Aucun Subject Pack créé
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
