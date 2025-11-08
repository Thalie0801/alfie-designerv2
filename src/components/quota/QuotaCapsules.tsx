import { cn } from '@/lib/utils';

interface QuotaCapsule {
  label: string;
  used: number;
  limit: number;
  icon?: string;
}

interface QuotaCapsulesProps {
  visuals: { used: number; limit: number };
  videos: { used: number; limit: number };
  woofs: { consumed: number; limit: number };
  className?: string;
}

function getCapsuleColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-100 text-red-700 border-red-300';
  if (percentage >= 70) return 'bg-orange-100 text-orange-700 border-orange-300';
  return 'bg-green-100 text-green-700 border-green-300';
}

function Capsule({ label, used, limit, icon }: QuotaCapsule) {
  const remaining = Math.max(0, limit - used);
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const colorClass = getCapsuleColor(percentage);

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
        colorClass
      )}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      <span className="font-semibold">
        {remaining}/{limit}
      </span>
    </div>
  );
}

export function QuotaCapsules({ visuals, videos, woofs, className }: QuotaCapsulesProps) {
  const woofsRemaining = Math.max(0, woofs.limit - woofs.consumed);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Capsule label="Visuels" used={visuals.used} limit={visuals.limit} icon="🎨" />
      <Capsule label="Vidéos" used={videos.used} limit={videos.limit} icon="🎬" />
      <Capsule label="Woofs" used={woofs.consumed} limit={woofs.limit} icon="🐕" />
    </div>
  );
}
