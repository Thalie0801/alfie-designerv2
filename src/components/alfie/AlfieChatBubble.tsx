import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * AlfieChatBubble
 * — Floating chat bubble that opens a right-side sheet with the Alfie chat.
 * — Vite + React + shadcn/ui + Tailwind. No Next.js dependencies.
 *
 * Quick install:
 * 1) Drop this file in: src/components/alfie/AlfieChatBubble.tsx
 * 2) Ensure shadcn/ui is installed and Button/Sheet are generated.
 * 3) Mount once, near <App /> root (e.g., in src/App.tsx) → <AlfieChatBubble />
 * 4) If your chat is an internal route, set `chatUrl` to "/chat" or the existing path.
 * 5) If you embed an existing component instead of iframe, replace <iframe> with <AlfieChatPanel />.
 *
 * Optional:
 * - Provide `brandId` to pass context via URL param.
 * - Set `zIndex` if the bubble hides behind other layers.
 */

interface AlfieChatBubbleProps {
  chatUrl?: string; // e.g. "/studio/chat" or external full URL
  brandId?: string;
  className?: string;
  zIndex?: number;
  defaultOpen?: boolean;
}

export default function AlfieChatBubble({
  chatUrl = "/studio/chat",
  brandId,
  className,
  zIndex = 60,
  defaultOpen = false,
}: AlfieChatBubbleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [unread, setUnread] = useState<number>(0);
  const [hover, setHover] = useState(false);
  const mountedRef = useRef(false);

  // Persist/restore open state if desired
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      const saved = localStorage.getItem("alfie_chat_open");
      if (saved === "1") setOpen(true);
      const u = Number(localStorage.getItem("alfie_unread") || 0);
      if (!Number.isNaN(u)) setUnread(u);
    } else {
      localStorage.setItem("alfie_chat_open", open ? "1" : "0");
    }
  }, [open]);

  // Example: listen to custom events to update unread counter
  useEffect(() => {
    const onUnread = (e: Event) => {
      const detail = (e as CustomEvent).detail as number | undefined;
      const next = typeof detail === "number" ? detail : unread + 1;
      setUnread(next);
      localStorage.setItem("alfie_unread", String(next));
    };
    window.addEventListener("alfie:chat:unread", onUnread as EventListener);
    return () => window.removeEventListener("alfie:chat:unread", onUnread as EventListener);
  }, [unread]);

  const url = useMemo(() => {
    const u = new URL(chatUrl, window.location.origin);
    if (brandId) u.searchParams.set("brandId", brandId);
    return u.toString();
  }, [chatUrl, brandId]);

  const handleOpen = () => {
    setOpen(true);
    setUnread(0);
    localStorage.setItem("alfie_unread", "0");
  };

  return (
    <div
      className={cn("pointer-events-none fixed bottom-4 right-4 md:bottom-6 md:right-6", className)}
      style={{ zIndex }}
    >
      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="pointer-events-auto"
          >
            <Button
              size="icon"
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              onClick={handleOpen}
              className={cn(
                "relative h-14 w-14 rounded-full shadow-xl",
                "bg-black text-white hover:bg-black/90",
                "border border-white/10"
              )}
            >
              <MessageCircle className="h-6 w-6" />
              {/* Unread badge */}
              <AnimatePresence>
                {unread > 0 && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-medium text-white"
                  >
                    {unread > 9 ? "9+" : unread}
                  </motion.span>
                )}
              </AnimatePresence>
              {/* Hover ripple */}
              <AnimatePresence>
                {hover && (
                  <motion.span
                    layoutId="alfie-bubble-hover"
                    className="absolute inset-0 rounded-full ring-4 ring-white/20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="p-0 w-[100vw] sm:w-[560px] max-w-[92vw]">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-semibold">Alfie Chat</SheetTitle>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </SheetHeader>

          {/*
            Replace the iframe by your internal chat component if needed.
            Example: <AlfieChatPanel brandId={brandId} />
          */}
          <div className="h-[calc(100vh-4rem)]">
            <iframe
              title="Alfie Chat"
              src={url}
              className="h-full w-full"
              referrerPolicy="no-referrer"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---- Usage example (App.tsx) ----------------------------------------------
// import AlfieChatBubble from "@/components/alfie/AlfieChatBubble";
// export default function App() {
//   return (
//     <>
//       <RouterProvider router={router} />
//       <AlfieChatBubble chatUrl="/studio/chat" />
//     </>
//   );
// }
