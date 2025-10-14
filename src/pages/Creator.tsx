import { useState } from 'react';
import { AppLayoutWithSidebar } from '@/components/AppLayoutWithSidebar';
import { AlfieChat } from '@/components/AlfieChat';
import { CreateHeader } from '@/components/create/CreateHeader';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  return (
    <AppLayoutWithSidebar>
      <div className="flex h-full min-h-[calc(100vh-8rem)] flex-col gap-6 bg-slate-50">
        <CreateHeader onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <div className="flex-1 overflow-hidden">
          <AlfieChat isSidebarOpen={isSidebarOpen} />
        </div>
      </div>
    </AppLayoutWithSidebar>
  );
}
