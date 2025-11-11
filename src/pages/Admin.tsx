import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminScreen } from '@/components/admin/AdminScreen';

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminScreen />
    </AdminGuard>
  );
}
