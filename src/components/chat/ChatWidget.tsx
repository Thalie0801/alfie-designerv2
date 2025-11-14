import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlfieChat } from '@/components/chat/AlfieChat';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  if (typeof document === 'undefined' || !isMounted) {
    return null;
  }

  return (
    <>
      {createPortal(
        <>
          <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
            {isOpen ? (
              <div className="w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl border bg-background shadow-lg">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-sm font-semibold">Alfie Chat</p>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Fermer">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="h-[480px]">
                  <AlfieChat mode="widget" variant="widget" onClose={() => setIsOpen(false)} />
                </div>
              </div>
            ) : null}

            <Button
              className="h-12 w-12 rounded-full shadow-lg"
              onClick={() => setIsOpen((prev) => !prev)}
              size="icon"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
