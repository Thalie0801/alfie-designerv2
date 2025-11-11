import { cn } from '@/lib/utils';

type GeneratorMode = 'auto' | 'image' | 'video' | 'text';

type RatioOption = '1:1' | '9:16' | '16:9' | '3:4';

interface ToolbarProps {
  mode: GeneratorMode;
  onModeChange: (mode: GeneratorMode) => void;
  ratio: RatioOption;
  onRatioChange: (ratio: RatioOption) => void;
}

export function Toolbar({ mode, onModeChange, ratio, onRatioChange }: ToolbarProps) {
  const modes: { value: GeneratorMode; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Vidéo' },
    { value: 'text', label: 'Texte' },
  ];

  const ratios: RatioOption[] = ['1:1', '9:16', '16:9', '3:4'];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {modes.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={cn(
              'inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              mode === value
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
            aria-pressed={mode === value}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'image' && (
        <div className="flex flex-wrap gap-2">
          {ratios.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onRatioChange(option)}
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                ratio === option
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
              aria-pressed={ratio === option}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type { GeneratorMode, RatioOption };
