import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Check, ChevronDown } from 'lucide-react';
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
];

interface EquipmentSceneProps {
  onSelect: (brandKitId: string | null) => void;
}

export function EquipmentScene({ onSelect }: EquipmentSceneProps) {
  const [selectedKit, setSelectedKit] = useState<BrandKit>(MOCK_BRAND_KITS[0]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      className="min-h-screen w-full flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-background/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-border/50"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-alfie-mint to-alfie-lilac flex items-center justify-center shadow-lg"
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-foreground mb-2">
            🛡️ Équipe ta marque
          </h2>
          <p className="text-center text-muted-foreground mb-6">
            Couleurs, typos, logo — on verrouille tout.
          </p>

          {/* Inventory Slot Style Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative bg-muted/50 rounded-2xl p-5 mb-6 border-2 border-dashed border-border"
          >
            {/* Slot decoration */}
            <div className="absolute -top-2 left-4 px-2 bg-background text-xs font-medium text-muted-foreground">
              ÉQUIPEMENT
            </div>

            <div className="flex items-center justify-between mb-4">
              <span className="font-bold text-foreground">{selectedKit.name}</span>
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

            {/* Palette as "potions" */}
            <div className="flex gap-2 mb-4">
              {selectedKit.palette.map((color, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.1, y: -3 }}
                  className="flex-1 h-10 rounded-xl shadow-md cursor-pointer"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 4px 12px ${color}60`,
                  }}
                />
              ))}
            </div>

            {/* Fonts */}
            <div className="flex gap-3 text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-background text-foreground font-medium">
                🔤 {selectedKit.fontDisplay}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-background text-muted-foreground">
                📝 {selectedKit.fontBody}
              </span>
            </div>
          </motion.div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={() => onSelect(selectedKit.id)}
              className="w-full h-14 text-base rounded-xl bg-gradient-to-r from-alfie-mint to-alfie-lilac hover:opacity-90 text-foreground font-bold shadow-lg"
            >
              ⚔️ Équiper ce Brand Kit
            </Button>
            <Button
              variant="outline"
              onClick={() => onSelect(null)}
              className="w-full h-12 text-base rounded-xl"
            >
              🎲 Mode démo
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
