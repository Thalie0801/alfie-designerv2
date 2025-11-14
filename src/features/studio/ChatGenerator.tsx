import { AlfieChat } from '@/components/chat/AlfieChat';

export function ChatGenerator() {
  return (
    <div className="flex h-full flex-col gap-4">
      <AlfieChat variant="page" />
    </div>
  );
}
