import { Menu, Plus, ScanBarcode } from 'lucide-react';
import { useState } from 'react';
import { NAV_ITEMS, type NavKey } from './Sidebar';

interface TopBarProps {
  activeNav: NavKey;
  onOpenMobileMenu: () => void;
  onQuickScan: (query: string) => void;
  onQuickInbound: () => void;
}

export function TopBar({
  activeNav,
  onOpenMobileMenu,
  onQuickScan,
  onQuickInbound,
}: TopBarProps) {
  const [scanInput, setScanInput] = useState('');
  const current = NAV_ITEMS.find((n) => n.key === activeNav) ?? NAV_ITEMS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    onQuickScan(scanInput.trim());
    setScanInput('');
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-8 border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="打开菜单"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
          <span className="hidden sm:inline whitespace-nowrap">SMT车间仓</span>
          <span className="hidden sm:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <h1 className="font-display text-base font-semibold text-slate-900 truncate">
            {current.label}
          </h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="hidden md:flex flex-1 max-w-md items-center gap-2"
      >
        <div className="relative flex-1">
          <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            aria-label="全局扫码追溯"
            placeholder="扫码枪直扫或输入 UID / Lot / 工单号 回车追溯"
            className="w-full rounded-md border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          扫码追溯
        </button>
      </form>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onQuickInbound}
          className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          快速入库
        </button>
      </div>
    </header>
  );
}
