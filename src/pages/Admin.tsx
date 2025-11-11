import ProtectedRoute from '@/components/ProtectedRoute';
import AdminGuard from '@/components/admin/AdminGuard';

export default function Admin() {
  return (
    <ProtectedRoute>
      <AdminGuard>
        <div className="p-6 space-y-6">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <div className="text-sm text-muted-foreground">
            Espace d’administration — accès réservé.
          </div>
          {/* Ex: <JobQueueMonitor /> */}
        </div>
      </AdminGuard>
    </ProtectedRoute>
  );
}
