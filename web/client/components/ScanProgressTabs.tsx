import type { ScanTabBucket } from '../../shared/types/wms';

interface ScanProgressTabsProps {
  activeBucket: ScanTabBucket;
  onChange: (bucket: ScanTabBucket) => void;
  counts: {
    SCANNED: number;
    IN_PROGRESS: number;
    UNSCANNED: number;
  };
  ariaLabel?: string;
}

const TAB_ITEMS: { key: ScanTabBucket; label: string; activeTone: string }[] = [
  { key: 'SCANNED', label: '已刷', activeTone: 'border-emerald-600 text-emerald-800' },
  { key: 'IN_PROGRESS', label: '作业中', activeTone: 'border-amber-600 text-amber-800' },
  { key: 'UNSCANNED', label: '未刷', activeTone: 'border-teal-700 text-teal-900' },
];

export function ScanProgressTabs({
  activeBucket,
  onChange,
  counts,
  ariaLabel = '扫码进度分组切换',
}: ScanProgressTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid grid-cols-3 border-b border-slate-200/90 bg-[#f8fafb]"
    >
      {TAB_ITEMS.map((item) => {
        const isActive = activeBucket === item.key;
        const count = counts[item.key];
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
            className={`min-h-[46px] flex items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-sm transition-colors whitespace-nowrap ${
              isActive
                ? `${item.activeTone} bg-white font-semibold`
                : 'border-transparent font-medium text-slate-500 hover:bg-slate-100/70 hover:text-slate-800'
            }`}
          >
            <span>{item.label}</span>
            <span className="font-mono text-xs tabular-nums">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
