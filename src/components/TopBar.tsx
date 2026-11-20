import { KeyRound, LogOut, Menu, Plus, ScanBarcode, UserCircle2 } from 'lucide-react';
import { useState } from 'react';
import { NAV_ITEMS, type NavKey } from './Sidebar';

interface TopBarProps {
  activeNav: NavKey;
  onOpenMobileMenu: () => void;
  onQuickScan: (query: string) => void;
  onQuickInbound: () => void;
  userName?: string | null;
  userEmail?: string | null;
  onOpenChangePassword?: () => void;
  onSignOut?: () => void;
}

export function TopBar({
  activeNav,
  onOpenMobileMenu,
  onQuickScan,
  onQuickInbound,
  userName,
  userEmail,
  onOpenChangePassword,
  onSignOut,
}: TopBarProps) {
  const [scanInput, setScanInput] = useState('');
  const current = NAV_ITEMS.find((n) => n.key === activeNav) ?? NAV_ITEMS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    onQuickScan(scanInput.trim());
    setScanInput('');
  };

  const displayUser = userName || userEmail || '';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 lg:gap-8 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="打开菜单"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
          <span className="hidden whitespace-nowrap sm:inline">SMT车间仓</span>
          <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="truncate font-display text-base font-semibold text-slate-900">
            {current.label}
          </h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="hidden max-w-md flex-1 items-center gap-2 md:flex"
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
          className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          扫码追溯
        </button>
      </form>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onQuickInbound}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-sky-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-sky-800"
        >
          <Plus className="h-3.5 w-3.5" />
          快速入库
        </button>

        {displayUser && (
          <div className="hidden items-center gap-1.5 border-l border-slate-200 pl-2.5 text-xs text-slate-600 xl:flex">
            <UserCircle2 className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="max-w-[140px] truncate" title={userEmail || displayUser}>
              {displayUser}
            </span>
          </div>
        )}

        {onOpenChangePassword && (
          <button
            type="button"
            onClick={onOpenChangePassword}
            aria-label="修改密码"
            title="修改密码"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">改密</span>
          </button>
        )}

        {onSignOut && (
          <button
            type="button"
            onClick={onSignOut}
            aria-label="退出登录"
            title="退出登录"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">退出</span>
          </button>
        )}
      </div>
    </header>
  );
}
