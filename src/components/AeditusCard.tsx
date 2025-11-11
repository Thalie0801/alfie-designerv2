const AEDITUS_FALLBACK = "https://aeditus.com/?utm_source=alfie&utm_medium=app&utm_campaign=upsell";
const AEDITUS_URL = import.meta.env.VITE_AEDITUS_URL ?? AEDITUS_FALLBACK;

interface AeditusCardProps {
  title?: string;
  message: string;
  ctaLabel?: string;
}

export function AeditusCard({ title, message, ctaLabel }: AeditusCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="text-sm font-semibold text-card-foreground">{title ?? "Suggestion"}</div>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <a
        href={AEDITUS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center rounded-2xl border border-border bg-background px-3 py-2 text-sm hover:shadow transition-shadow"
      >
        {ctaLabel ?? "Ouvrir Aeditus"}
      </a>
      <p className="mt-2 text-xs text-muted-foreground">
        Aeditus est une plateforme SaaS dédiée à la rédaction et à la stratégie de contenu.
      </p>
    </div>
  );
}
