import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "33600000000"; // TODO: Remplacer par le numéro officiel
const DEFAULT_MESSAGE = "Bonjour Alfie Designer !";

const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

export function ProspectBubble() {
  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Discuter avec l'équipe commerciale sur WhatsApp"
      className="fixed bottom-4 right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 shadow-lg shadow-emerald-200 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
    >
      <MessageCircle className="h-6 w-6" aria-hidden="true" />
    </a>
  );
}
