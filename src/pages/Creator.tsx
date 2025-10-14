import { AppLayoutWithSidebar } from '@/components/AppLayoutWithSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlfieChat } from '@/components/AlfieChat';
import { Sparkles, Zap, Palette } from 'lucide-react';
import { useAlfieCredits } from '@/hooks/useAlfieCredits';
import { useBrandKit } from '@/hooks/useBrandKit';

export default function App() {
  const { totalCredits } = useAlfieCredits();
  const { totalBrands, quotaBrands } = useBrandKit();

  return (
    <AppLayoutWithSidebar>
      <div className="space-y-6">
      {/* Header */}
      <div className="gradient-subtle rounded-2xl p-6 border-2 border-primary/20 shadow-medium">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-xl shadow-glow">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Alfie Designer
          </h1>
        </div>
        <p className="text-muted-foreground">
          Ton assistant créatif IA qui trouve, adapte et génère des visuels Canva sur mesure 🎨✨
        </p>
      </div>

      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalCredits}</p>
                  <p className="text-xs text-muted-foreground">Crédits IA restants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-secondary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="bg-secondary/10 p-3 rounded-lg">
                  <Palette className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalBrands}/{quotaBrands}</p>
                  <p className="text-xs text-muted-foreground">Marques créées</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Chat Interface - Full Width */}
        <Card className="shadow-strong border-2 border-primary/20 max-w-5xl mx-auto">
          <CardHeader className="border-b bg-gradient-subtle">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Chat avec Alfie
            </CardTitle>
            <CardDescription>
              Décris ce que tu veux créer, Alfie s'occupe du reste
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <AlfieChat />
          </CardContent>
        </Card>
      </div>
      </div>
    </AppLayoutWithSidebar>
  );
}
