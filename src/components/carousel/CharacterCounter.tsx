import { cn } from '@/lib/utils';

interface CharacterCounterProps {
  current: number;
  min?: number;
  max: number;
  label?: string;
  className?: string;
}

export function CharacterCounter({ current, min, max, label, className }: CharacterCounterProps) {
  const percentage = (current / max) * 100;
  const isWarning = percentage >= 90 && percentage <= 100;
  const isError = current > max || (min && current < min);

  const getColor = () => {
    if (isError) return 'text-destructive';
    if (isWarning) return 'text-orange-500';
    return 'text-success';
  };

  const getBgColor = () => {
    if (isError) return 'bg-destructive/20';
    if (isWarning) return 'bg-orange-500/20';
    return 'bg-success/20';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      <div className="flex items-center gap-1">
        <span className={cn('text-xs font-medium', getColor())}>
          {current}/{max}
        </span>
        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full transition-all duration-200', getBgColor())}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
