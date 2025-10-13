import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useBrandKit } from '@/hooks/useBrandKit';
import { toast } from 'sonner';
import { Palette, Upload, X } from 'lucide-react';

export function BrandKitManager() {
  const { brandKit, updateBrandKit } = useBrandKit();
  const [colors, setColors] = useState<string[]>(brandKit?.palette || ['#000000']);
  const [logoUrl, setLogoUrl] = useState(brandKit?.logo_url || '');

  const handleAddColor = () => {
    if (colors.length < 5) {
      setColors([...colors, '#000000']);
    }
  };

  const handleColorChange = (index: number, value: string) => {
    const newColors = [...colors];
    newColors[index] = value;
    setColors(newColors);
  };

  const handleRemoveColor = (index: number) => {
    const newColors = colors.filter((_, i) => i !== index);
    setColors(newColors);
  };

  const handleSave = () => {
    // Deprecated - use BrandManager instead
    toast.info('Utilise le nouveau Brand Manager pour gérer tes marques ! 🎨');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Brand Kit
        </CardTitle>
        <CardDescription>
          Configure les couleurs et le logo de ta marque pour personnaliser tes designs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Palette de couleurs */}
        <div className="space-y-3">
          <Label>Palette de couleurs</Label>
          <div className="space-y-2">
            {colors.map((color, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  className="w-20 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  className="flex-1 font-mono"
                  placeholder="#000000"
                />
                {colors.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveColor(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {colors.length < 5 && (
            <Button variant="outline" size="sm" onClick={handleAddColor}>
              Ajouter une couleur
            </Button>
          )}
        </div>

        {/* Logo */}
        <div className="space-y-3">
          <Label htmlFor="logo">Logo URL</Label>
          <div className="flex gap-2">
            <Input
              id="logo"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
            />
            <Button variant="outline" size="icon">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
          {logoUrl && (
            <div className="mt-2">
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-20 object-contain border rounded p-2"
              />
            </div>
          )}
        </div>

        <Button onClick={handleSave} className="w-full">
          Sauvegarder le Brand Kit
        </Button>
      </CardContent>
    </Card>
  );
}
