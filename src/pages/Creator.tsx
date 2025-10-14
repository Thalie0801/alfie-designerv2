import { AppLayoutWithSidebar } from '@/components/AppLayoutWithSidebar';
import { AlfieChat } from '@/components/AlfieChat';
import { ChatHeader } from '@/components/ChatHeader';

export default function App() {
  return (
    <AppLayoutWithSidebar>
      <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
        {/* Header compact sticky */}
        <ChatHeader />
        
        {/* Chat qui prend tout l'espace restant */}
        <div className="flex-1 overflow-hidden">
          <AlfieChat />
        </div>
      </div>
    </AppLayoutWithSidebar>
  );
}
