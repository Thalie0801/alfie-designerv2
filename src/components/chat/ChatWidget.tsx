import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);

  // Permet de désactiver via ?chat=off
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("chat") === "off" || localStorage.getItem("alfie_chat") === "off") {
      return null;
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-br from-emerald-400 to-teal-500 hover:scale-110 transition-transform duration-200 flex items-center justify-center z-50"
        aria-label="Ouvrir Alfie Chat"
      >
        <MessageCircle className="h-6 w-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
        <h3 className="font-semibold text-gray-900">Alfie Chat</h3>
        <button
          onClick={() => setOpen(false)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Fermer"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <iframe
          title="Alfie Chat Interface"
          src="/studio"
          className="w-full h-full border-0"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
