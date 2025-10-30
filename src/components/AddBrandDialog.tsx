import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { useBrandManagement } from '@/hooks/useBrandManagement';

interface AddBrandDialogProps {
  onSuccess?: () => void;
}

export function AddBrandDialog({ onSuccess }: AddBrandDialogProps) {
  const [open, setOpen] = useState(false);
  const [brandName, setBrandName] = useState('');
  const { createAddonBrand, loading } = useBrandManagement();

  const handleCreate = async () => {
    if (!brandName.trim()) return;

    const brand = await createAddonBrand({ name: brandName.trim() });
    if (brand) {
      setBrandName('');
      setOpen(false);
      onSuccess?.();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une marque
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une marque</DialogTitle>
            <DialogDescription>
              Créez une nouvelle marque gratuite.
            </DialogDescription>
          </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">Nom de la marque</Label>
            <Input
              id="brand-name"
              placeholder="Ex: Ma nouvelle marque"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                }
              }}
            />
          </div>

        </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={loading || !brandName.trim()}
            >
              {loading ? 'Création...' : 'Créer la marque'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
