import {
  ArrowDownToLine,
  Boxes,
  ClipboardCheck,
  Database,
  Layers,
  LayoutDashboard,
  RefreshCw,
  ScanBarcode,
  X,
} from 'lucide-react';

export type NavKey =
  | 'dashboard'
  | 'inbound'
  | 'wave'
  | 'replenish'
  | 'scrapCount'
  | 'trace'
  | 'master';

export const NAV_ITEMS: { key: NavKey; label: string; sub: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: '仓储总览', sub: '运营看板与预警', icon: LayoutDashboard },
  { key: 'inbound', label: '入库与ASN管理', sub: 'ASN预约/采购导入/赋码', icon: ArrowDownToLine },
  { key: 'wave', label: '波次发料与出库', sub: '工单BOM/FIFO拣货', icon: Layers },
  { key: 'replenish', label: '补料与退料', sub: 'SMT抛料补领/余料退库', icon: RefreshCw },
  { key: 'scrapCount', label: '报废与盘点', sub: 'MRB处置/盘点调账', icon: ClipboardCheck },
  { key: 'trace', label: '全程扫码追溯', sub: 'UID/批次/工单正反查', icon: ScanBarcode },
  { key: 'master', label: '基础档案与台账', sub: '仓库/库位/客商/BOM/工单', icon: Database },
];

interface SidebarProps {
  active: NavKey;
  onSelect: (key: NavKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  msdAlertCount: number;
}

export function Sidebar({
  active,
  onSelect,
  mobileOpen,
  onCloseMobile,
  msdAlertCount,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-700 text-white">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            智造 SMT-WMS
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="关闭侧边导航"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label="主导航" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onSelect(item.key);
                onCloseMobile();
              }}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                isActive
                  ? 'bg-sky-50 text-sky-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? 'text-sky-700' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold whitespace-nowrap truncate">
                    {item.label}
                  </span>
                  {item.key === 'master' && msdAlertCount > 0 && (
                    <span className="font-mono text-xs font-semibold text-red-600 tabular-nums">
                      {msdAlertCount}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{item.sub}</div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <div className="font-medium text-slate-700">独立无ERP运行模式</div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          内置SKU/BOM/工单/UID防呆体系
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 lg:block">{navContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw]">{navContent}</aside>
        </div>
      )}
    </>
  );
}
