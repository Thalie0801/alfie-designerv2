import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const AEDITUS_FALLBACK = "https://aeditus.com/?utm_source=alfie&utm_medium=app&utm_campaign=upsell";
const RAW_AEDITUS_URL = import.meta.env.VITE_AEDITUS_URL || AEDITUS_FALLBACK;

type AeditusCardVariant = "default" | "soft" | "compact";

interface AeditusCardProps {
  title?: string;
  message: string;
  ctaLabel?: string;
  className?: string;
  /** Ajoute/écrase des UTM (utm_source, utm_medium, utm_campaign, utm_content, utm_term) */
  utm?: Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term", string>>;
  /** Contexte pour `utm_content` (ex: emplacement de la carte) */
  context?: string;
  /** Event tracker optionnel (ex: posthog/GA) */
  onTrackClick?: (payload: { href: string; title: string; context?: string }) => void;
  /** style visuel */
  variant?: AeditusCardVariant;
  /** désactiver l’icône externe */
  hideIcon?: boolean;
  /** data-testid pour tests */
  "data-testid"?: string;
}

function buildAeditusUrl(base: string, overrides?: AeditusCardProps["utm"], context?: string) {
  // force https + URL valide
  const safeBase = base.startsWith("http") ? base : `https://${base}`;
  let url: URL;
  try {
    url = new URL(safeBase);
  } catch {
    url = new URL(AEDITUS_FALLBACK);
  }

  // UTM par défaut si absents
  const defaults = {
    utm_source: "alfie",
    utm_medium: "app",
    utm_campaign: "upsell",
  };

  const params = { ...defaults, ...(overrides || {}) } as Record<string, string>;
  if (context && !params.utm_content) params.utm_content = context;

  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });

  return url.toString();
}

export function AeditusCard({
  title = "Suggestion",
  message,
  ctaLabel = "Ouvrir Aeditus",
  className,
  utm,
  context,
  onTrackClick,
  variant = "default",
  hideIcon = false,
  ...rest
}: AeditusCardProps) {
  const href = useMemo(() => buildAeditusUrl(RAW_AEDITUS_URL, utm, context), [utm, context]);

  const variantClasses =
    variant === "soft" ? "border-primary/20 bg-primary/5" : variant === "compact" ? "py-3" : "bg-card";

  return (
    <Card className={cn("rounded-2xl border border-border shadow-sm", variantClasses, className)} {...rest}>
      <CardContent className={cn("p-4", variant === "compact" && "p-3")}>
        <div className="text-sm font-semibold text-card-foreground">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>

        <Button
          asChild
          variant="secondary"
          size={variant === "compact" ? "sm" : "default"}
          className="mt-3 rounded-2xl"
          onClick={() => onTrackClick?.({ href, title, context })}
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer external"
            aria-label={`${ctaLabel} (ouvre un nouvel onglet)`}
          >
            <span className="inline-flex items-center gap-2">
              {ctaLabel}
              {!hideIcon && <ExternalLink className="h-4 w-4" aria-hidden />}
            </span>
          </a>
        </Button>

        <p className="mt-2 text-xs text-muted-foreground">
          Aeditus est une plateforme SaaS dédiée à la rédaction et à la stratégie de contenu.
        </p>
      </CardContent>
    </Card>
  );
}
