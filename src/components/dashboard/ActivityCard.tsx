import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Image, Video, Zap } from 'lucide-react';
import { useActivityStats } from '@/hooks/useActivityStats';

interface ActivityCardProps {
  activeBrandId: string | null;
}

export function ActivityCard({ activeBrandId }: ActivityCardProps) {
  const { stats, loading } = useActivityStats(activeBrandId);

  if (loading || !stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  const imagesPercentage = stats.imagesQuota > 0 ? (stats.imagesCount / stats.imagesQuota) * 100 : 0;
  const videosPercentage = stats.videosQuota > 0 ? (stats.videosCount / stats.videosQuota) * 100 : 0;
  const woofsPercentage = stats.woofsQuota > 0 ? (stats.totalWoofsUsed / stats.woofsQuota) * 100 : 0;

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-accent/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Activité ce mois
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visuels */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Visuels</span>
            </div>
            <span className="text-muted-foreground">
              {stats.imagesCount} / {stats.imagesQuota}
            </span>
          </div>
          <Progress value={Math.min(imagesPercentage, 100)} className="h-2" />
        </div>

        {/* Vidéos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Vidéos</span>
            </div>
            <span className="text-muted-foreground">
              {stats.videosCount} / {stats.videosQuota}
            </span>
          </div>
          <Progress value={Math.min(videosPercentage, 100)} className="h-2" />
        </div>

        {/* Woofs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Woofs</span>
            </div>
            <span className="text-muted-foreground">
              {stats.totalWoofsUsed} / {stats.woofsQuota}
            </span>
          </div>
          <Progress value={Math.min(woofsPercentage, 100)} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
