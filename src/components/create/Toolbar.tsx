import { cn } from '@/lib/utils';

export type CreateMode = 'auto' | 'image' | 'video' | 'text';
export type CreateRatio = '1:1' | '9:16' | '16:9' | '3:4';

interface ToolbarProps {
  mode: CreateMode;
  onModeChange: (mode: CreateMode) => void;
  ratio: CreateRatio | null;
  onRatioChange: (ratio: CreateRatio) => void;
  showRatioOptions: boolean;
}

const modeOptions: { value: CreateMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Vidéo' },
  { value: 'text', label: 'Texte' },
];

const ratioOptions: CreateRatio[] = ['1:1', '9:16', '16:9', '3:4'];

export function Toolbar({ mode, onModeChange, ratio, onRatioChange, showRatioOptions }: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-md backdrop-blur transition-shadow duration-200 hover:shadow-lg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Mode</span>
        <div className="flex flex-wrap gap-2">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onModeChange(option.value)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                mode === option.value
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {showRatioOptions && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Ratio</span>
          <div className="flex flex-wrap gap-2">
            {ratioOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onRatioChange(value)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                  ratio === value
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
