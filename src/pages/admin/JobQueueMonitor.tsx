import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobQueueMonitor } from '@/components/admin/JobQueueMonitor';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminJobQueueMonitorPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour Admin
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Monitoring de la job queue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Supervisez les jobs en attente, débloquez ceux qui sont stuck et forcez le worker à redémarrer.
          </p>
          <JobQueueMonitor />
        </CardContent>
      </Card>
    </div>
  );
}
