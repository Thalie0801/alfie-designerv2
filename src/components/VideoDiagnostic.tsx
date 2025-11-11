import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Activity } from 'lucide-react';

export function VideoDiagnostic() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleDiagnose = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: { diagnose: true },
      });

      if (error) throw error;

      setResult(data);
      toast.success('Diagnostic réussi');
    } catch (error: any) {
      console.error('Diagnostic error:', error);
      toast.error('Erreur lors du diagnostic');
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <CardTitle>Diagnostic Vidéo (IP Whitelist)</CardTitle>
        </div>
        <CardDescription>
          Obtenir l'IP sortante du backend pour whitelister chez Kie.ai
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleDiagnose} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Diagnostic en cours...' : 'Diagnostiquer IP vidéo'}
        </Button>

        {result && (
          <div className="rounded-lg border p-4 bg-muted/50">
            {result.error ? (
              <p className="text-sm text-destructive">{result.error}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">IP sortante détectée :</p>
                <code className="block p-2 bg-background rounded text-sm">
                  {result.ip}
                </code>
                {result.message && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {result.message}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
