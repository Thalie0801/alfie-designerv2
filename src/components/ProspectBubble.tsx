import { MessageCircle, Users } from "lucide-react";

const WHATSAPP_NUMBER = "33745263064";
const DEFAULT_MESSAGE = "Bonjour Alfie Designer !";
const WHATSAPP_COMMUNITY = "https://chat.whatsapp.com/HSqUJEeaugS4wVU2gyaJbs";
const FACEBOOK_COMMUNITY = "https://www.facebook.com/groups/4851359094985657";

const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

export function ProspectBubble() {
  return (
    <div className="fixed bottom-20 right-4 sm:bottom-4 sm:right-20 z-[9997] flex flex-col gap-2">
      {/* Groupe Facebook */}
      <a
        href={FACEBOOK_COMMUNITY}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Rejoindre la communauté Alfie sur Facebook"
        className="inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-lg shadow-blue-200 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <Users className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
      </a>
      
      {/* WhatsApp Communauté */}
      <a
        href={WHATSAPP_COMMUNITY}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Rejoindre le groupe WhatsApp Alfie"
        className="inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-green-100 text-green-700 shadow-lg shadow-green-200 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500"
      >
        <Users className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
      </a>
      
      {/* WhatsApp Direct */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Discuter avec l'équipe commerciale sur WhatsApp"
        className="inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 shadow-lg shadow-emerald-200 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
      </a>
    </div>
  );
}
