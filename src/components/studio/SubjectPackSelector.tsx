import { useSubjectPacks } from '@/hooks/useSubjectPacks';
import { useBrandKit } from '@/hooks/useBrandKit';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Package, Sparkles, Dog, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubjectPackSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  brandId?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showDefaultOption?: boolean;  // Show "Par défaut (Brand Kit)" option
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
  showDefaultOption = false,
}: SubjectPackSelectorProps) {
  const { packs, loading } = useSubjectPacks(brandId);
  const { activeBrand } = useBrandKit();
  
  // Find the default pack from brand kit
  const defaultPackId = (activeBrand as { default_subject_pack_id?: string })?.default_subject_pack_id;
  const defaultPack = packs.find(p => p.id === defaultPackId);

  // Determine the display value
  const displayValue = value === 'default' ? 'default' : (value || 'none');

  const handleChange = (v: string) => {
    if (v === 'none') {
      onChange(null);
    } else if (v === 'default') {
      onChange(defaultPackId || null);
    } else {
      onChange(v);
    }
  };

  return (
    <Select
      value={displayValue}
      onValueChange={handleChange}
      disabled={disabled || loading}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={loading ? "Chargement..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {/* Default from Brand Kit option */}
        {showDefaultOption && (
          <SelectItem value="default">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
                {defaultPack ? (
                  <img
                    src={defaultPack.master_image_url}
                    alt={defaultPack.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <Star className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">Par défaut (Brand Kit)</span>
                <span className="text-xs text-muted-foreground">
                  {defaultPack ? defaultPack.name : 'Aucun défini'}
                </span>
              </div>
            </div>
          </SelectItem>
        )}

        {/* No subject option */}
        <SelectItem value="none">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Aucun subject</span>
          </div>
        </SelectItem>
        
        {/* All available packs */}
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
                <span className="font-medium text-sm flex items-center gap-1">
                  {pack.name}
                  {pack.id === defaultPackId && (
                    <Star className="h-3 w-3 text-primary fill-primary" />
                  )}
                </span>
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
