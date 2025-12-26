import { ExternalLink } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CanvaButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** URL publique de l'image (Cloudinary) à importer dans Canva */
  imageUrl?: string;
  /** Pour les packs multi-images, on prend la première */
  imageUrls?: string[];
  /** Label personnalisé */
  label?: string;
  /** Affiche un toast de confirmation */
  showToast?: boolean;
}

/**
 * Génère un lien d'import Canva à partir d'une URL d'image publique.
 * Fonctionne sans API Canva - l'utilisateur se connecte à son propre compte.
 * @see https://www.canva.com/import?design_url=...
 */
export function generateCanvaImportLink(imageUrl: string): string {
  return `https://www.canva.com/import?design_url=${encodeURIComponent(imageUrl)}`;
}

/**
 * Bouton réutilisable pour ouvrir une image dans Canva.
 * Utilise le lien d'import public de Canva (sans API).
 */
export function CanvaButton({
  imageUrl,
  imageUrls,
  label = "Ouvrir dans Canva",
  showToast = true,
  className,
  variant = "outline",
  size = "sm",
  ...props
}: CanvaButtonProps) {
  // Prendre la première URL disponible
  const url = imageUrl || imageUrls?.[0];

  if (!url) {
    return null;
  }

  const handleClick = () => {
    const canvaLink = generateCanvaImportLink(url);
    window.open(canvaLink, "_blank");
    
    if (showToast) {
      toast.success("Ouverture dans Canva... 🎨", {
        description: "Connectez-vous à votre compte Canva pour éditer",
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn("gap-2", className)}
      {...props}
    >
      <ExternalLink className="h-4 w-4" />
      {label}
    </Button>
  );
}

/**
 * Icône Canva personnalisée (optionnelle)
 */
export function CanvaIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-4 w-4", className)}
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 17.785c-.762.762-2.016.762-2.778 0l-2.83-2.83-2.829 2.83c-.762.762-2.016.762-2.778 0-.762-.762-.762-2.016 0-2.778l2.83-2.83-2.83-2.829c-.762-.762-.762-2.016 0-2.778.762-.762 2.016-.762 2.778 0l2.83 2.83 2.829-2.83c.762-.762 2.016-.762 2.778 0 .762.762.762 2.016 0 2.778l-2.83 2.83 2.83 2.829c.762.762.762 2.016 0 2.778z" />
    </svg>
  );
}
