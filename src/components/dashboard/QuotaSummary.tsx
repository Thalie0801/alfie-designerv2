import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Video as VideoIcon, Zap, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { callEdge } from "@/lib/edgeClient";
import { cn } from "@/lib/utils";

interface QuotaSummaryProps {
  activeBrandId: string | null;
}

interface QuotaResponse {
  visuals_quota: number;
  visuals_used: number;
  videos_quota: number;
  videos_used: number;
  woofs_quota: number;
  woofs_used: number;
  plan?: string;
  is_admin?: boolean;
}

const HUMAN_FORMATTER = new Intl.NumberFormat("fr-FR");

function percent(used: number, quota: number) {
  if (!quota || quota <= 0) return 0;
  const p = (used / quota) * 100;
  return Number.isFinite(p) ? Math.max(0, p) : 0;
}

function barClass(p: number) {
  if (p >= 110) return "bg-destructive";
  if (p >= 80) return "bg-amber-400";
  return "bg-primary";
}

function isUnlimited(quota: number, isAdmin?: boolean) {
  return isAdmin || !quota || quota >= 1_000_000_000;
}

function human(n: number) {
  return HUMAN_FORMATTER.format(n);
}

export function QuotaSummary({ activeBrandId }: QuotaSummaryProps) {
  const [data, setData] = useState<QuotaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeBrandId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await callEdge<QuotaResponse>("get-quota", { brand_id: activeBrandId }, { silent: true });
        if (cancelled) return;
        if (response.ok && response.data) {
          setData(response.data);
        } else {
          setError("Quotas indisponibles");
        }
      } catch (err) {
        console.error("[QuotaSummary] error", err);
        if (!cancelled) setError("Quotas indisponibles");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeBrandId]);

  const rows = useMemo(
    () =>
      data
        ? [
            {
              label: "Images",
              used: data.visuals_used ?? 0,
              quota: data.visuals_quota ?? 0,
              icon: ImageIcon,
              testId: "images",
            },
            {
              label: "Reels/Carrousels",
              used: data.videos_used ?? 0,
              quota: data.videos_quota ?? 0,
              icon: VideoIcon,
              testId: "videos",
            },
            {
              label: "Woofs",
              used: data.woofs_used ?? 0,
              quota: data.woofs_quota ?? 0,
              icon: Zap,
              testId: "woofs",
            },
          ]
        : [],
    [data],
  );

  if (!activeBrandId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">Sélectionne une marque pour voir tes quotas.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            Quotas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2].map((key) => (
            <div className="space-y-2" key={key}>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Gauge className="h-5 w-5" />
            Quotas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error || "Quotas indisponibles"}</p>
        </CardContent>
      </Card>
    );
  }

  const hasUnlimitedQuotas = data.is_admin || rows.some((row) => isUnlimited(row.quota, data.is_admin));

  return (
    <Card className="bg-muted/30 border-primary/10 shadow-strong">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Quotas
          {data.is_admin ? <Badge className="ml-2" variant="secondary">Admin</Badge> : null}
        </CardTitle>
        <div className="flex items-center gap-2">
          {hasUnlimitedQuotas ? <Badge variant="secondary">Illimité</Badge> : null}
          {data.plan ? <Badge variant="outline">Plan {data.plan}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(({ label, used, quota, icon: Icon, testId }) => {
          const unlimited = isUnlimited(quota, data.is_admin);
          const p = unlimited ? 0 : percent(used, quota);
          const remaining = unlimited ? "Illimité" : `${human(Math.max(0, quota - used))} restants`;

          return (
            <div className="space-y-2" key={testId} data-testid={`quota-${testId}`}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{label}</span>
                  <Badge variant={unlimited ? "outline" : "secondary"}>{remaining}</Badge>
                </div>
                <span className="tabular-nums text-muted-foreground">
                  {human(used)} / {unlimited ? "Illimité" : human(quota)} {unlimited ? "" : `(${Math.round(p)}%)`}
                </span>
              </div>

              {!unlimited ? (
                <Progress
                  value={Math.min(120, p)}
                  className={cn("h-2", barClass(p))}
                  aria-valuenow={p}
                  aria-valuemin={0}
                  aria-valuemax={120}
                />
              ) : (
                <div className="h-2 rounded-full bg-primary/20" aria-label="Quota illimité" />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
