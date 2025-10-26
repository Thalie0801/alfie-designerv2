import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Image, Video, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Creation {
  id: string;
  type: string;
  output_url: string;
  thumbnail_url: string | null;
  created_at: string | null;
  prompt: string | null;
}

export function RecentCreations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creations, setCreations] = useState<Creation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadCreations();
  }, [user]);

  const loadCreations = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('media_generations')
        .select('id, type, output_url, thumbnail_url, created_at, prompt')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6);

      setCreations(data || []);
    } catch (error) {
      console.error('Error loading recent creations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  if (creations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Dernières créations
          </CardTitle>
          <button
            onClick={() => navigate('/library')}
            className="text-sm text-primary hover:underline"
          >
            Voir tout →
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {creations.map((creation) => (
            <div
              key={creation.id}
              onClick={() => navigate('/library')}
              className="group relative aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary cursor-pointer transition-all"
            >
              <img
                src={creation.thumbnail_url || creation.output_url}
                alt={creation.prompt || 'Création'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center">
                {creation.type === 'video' ? (
                  <Video className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <Image className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <div className="absolute top-2 right-2">
                <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                  {creation.type === 'video' ? '▶' : '🖼'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
