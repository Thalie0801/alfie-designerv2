import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BrandKit {
  id: string;
  name: string;
  palette: string[];
  fontDisplay: string;
  fontBody: string;
  logoUrl?: string;
}

// Mock brand kits
const MOCK_BRAND_KITS: BrandKit[] = [
  {
    id: 'kit-1',
    name: 'Ma marque principale',
    palette: ['#7EE2E0', '#FF8BC2', '#E0C9FF', '#FFD4B8', '#FFF9C4'],
    fontDisplay: 'Poppins',
    fontBody: 'Inter',
  },
  {
    id: 'kit-2',
    name: 'Projet secondaire',
    palette: ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981'],
    fontDisplay: 'Montserrat',
    fontBody: 'Open Sans',
  },
  {
    id: 'kit-3',
    name: 'Side project',
    palette: ['#1F2937', '#374151', '#6B7280', '#D1D5DB', '#F9FAFB'],
    fontDisplay: 'Space Grotesk',
    fontBody: 'DM Sans',
  },
];

interface BrandKitQuickPickProps {
  onSelect: (brandKitId: string | null) => void;
}

export function BrandKitQuickPick({ onSelect }: BrandKitQuickPickProps) {
  const [selectedKit, setSelectedKit] = useState<BrandKit>(MOCK_BRAND_KITS[0]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #E3FBF9 0%, #FFE4EC 25%, #E8D5FF 50%, #FFD4B8 75%, #FFF9C4 100%)',
      }}
    >
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl"
        >
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-alfie-mint to-alfie-lilac rounded-2xl flex items-center justify-center">
            <Palette className="w-8 h-8 text-white" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-foreground mb-2">
            On utilise ta marque ?
          </h2>
          <p className="text-center text-muted-foreground mb-6">
            Couleurs, typos, logo — je verrouille tout.
          </p>

          {/* Selected Kit Preview */}
          <div className="bg-muted/50 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-foreground">{selectedKit.name}</span>
              {MOCK_BRAND_KITS.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1">
                      Changer
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {MOCK_BRAND_KITS.map((kit) => (
                      <DropdownMenuItem
                        key={kit.id}
                        onClick={() => setSelectedKit(kit)}
                        className="flex items-center gap-2"
                      >
                        {kit.id === selectedKit.id && <Check className="w-4 h-4" />}
                        <span className={kit.id === selectedKit.id ? 'font-medium' : ''}>
                          {kit.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {/* Palette Preview */}
            <div className="flex gap-1 mb-3">
              {selectedKit.palette.map((color, i) => (
                <div
                  key={i}
                  className="flex-1 h-8 rounded-lg first:rounded-l-xl last:rounded-r-xl"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            {/* Fonts */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Display: {selectedKit.fontDisplay}</span>
              <span>Body: {selectedKit.fontBody}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => onSelect(selectedKit.id)}
              className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-alfie-mint to-alfie-lilac hover:opacity-90 text-foreground font-semibold"
            >
              Oui, mon Brand Kit
            </Button>
            <Button
              variant="outline"
              onClick={() => onSelect(null)}
              className="w-full h-12 text-base rounded-xl"
            >
              Mode démo
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
