import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Trophy, Check, Circle } from 'lucide-react';
import { useBrandKit } from '@/hooks/useBrandKit';
import { useActivityStats } from '@/hooks/useActivityStats';

export function ProfileProgress() {
  const { activeBrand, activeBrandId, totalBrands } = useBrandKit();
  const { stats } = useActivityStats(activeBrandId);

  const tasks = [
    {
      id: 'brand',
      label: 'Créer une marque',
      completed: totalBrands > 0,
      points: 20,
    },
    {
      id: 'palette',
      label: 'Définir une palette de couleurs',
      completed: activeBrand?.palette && activeBrand.palette.length > 0,
      points: 15,
    },
    {
      id: 'voice',
      label: 'Définir le ton de la marque',
      completed: Boolean(activeBrand?.voice),
      points: 15,
    },
    {
      id: 'logo',
      label: 'Ajouter un logo',
      completed: Boolean(activeBrand?.logo_url),
      points: 10,
    },
    {
      id: 'canva',
      label: 'Connecter Canva',
      completed: Boolean(activeBrand?.canva_connected),
      points: 20,
    },
    {
      id: 'generation',
      label: 'Créer ta première génération',
      completed: (stats?.imagesCount || 0) + (stats?.videosCount || 0) > 0,
      points: 20,
    },
  ];

  const totalPoints = tasks.reduce((sum, task) => sum + (task.completed ? task.points : 0), 0);
  const maxPoints = tasks.reduce((sum, task) => sum + task.points, 0);
  const percentage = (totalPoints / maxPoints) * 100;

  return (
    <Card className="bg-gradient-to-br from-accent/10 to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Profil complété à {totalPoints}%
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={percentage} className="h-3" />
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-2 text-sm"
            >
              {task.completed ? (
                <Check className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={task.completed ? 'text-muted-foreground line-through' : ''}>
                {task.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
