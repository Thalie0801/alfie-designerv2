import { ChatGenerator } from '@/components/create/ChatGenerator';
import { AccessGuard } from '@/components/AccessGuard';

export default function Creator() {
  return (
    <AccessGuard>
      <ChatGenerator />
    </AccessGuard>
  );
}
