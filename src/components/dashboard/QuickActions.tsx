import { Button } from '@/components/ui/button';
import { Image, Video, Library, Layout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Button
        onClick={() => navigate('/app')}
        variant="outline"
        className="h-24 flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all"
      >
        <Image className="h-6 w-6" />
        <span className="font-medium">Créer un visuel</span>
      </Button>
      <Button
        onClick={() => navigate('/app')}
        variant="outline"
        className="h-24 flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all"
      >
        <Video className="h-6 w-6" />
        <span className="font-medium">Créer une vidéo</span>
      </Button>
      <Button
        onClick={() => navigate('/library')}
        variant="outline"
        className="h-24 flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all"
      >
        <Library className="h-6 w-6" />
        <span className="font-medium">Ma bibliothèque</span>
      </Button>
      <Button
        onClick={() => navigate('/templates')}
        variant="outline"
        className="h-24 flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all"
      >
        <Layout className="h-6 w-6" />
        <span className="font-medium">Templates</span>
      </Button>
    </div>
  );
}
