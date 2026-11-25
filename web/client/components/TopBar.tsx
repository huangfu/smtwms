import {
  ArrowLeft,
  KeyRound,
  LayoutGrid,
  Lock,
  LogOut,
  Menu,
  ScanBarcode,
  UserCircle2,
} from 'lucide-react';
import { useState } from 'react';
import {
  canSwitchDepartmentView,
  DEPARTMENT_LIST,
  DEPARTMENT_META,
  USER_ROLE_META,
  type DepartmentRole,
  type UserRole,
} from '../../shared/domain/roleAccess';
import { NAV_ITEMS, type NavKey } from './Sidebar';

interface TopBarProps {
  activeNav: NavKey;
  userRole: UserRole;
  departmentRole: DepartmentRole;
  onChangeDepartmentRole: (role: DepartmentRole) => void;
  notifiedIqcCount: number;
  iqcReleasedPutawayCount: number;
  onOpenMobileMenu: () => void;
  onSelectNav: (nav: NavKey) => void;
  onQuickScan: (query: string) => void;
  userName?: string | null;
  userEmail?: string | null;
  onOpenChangePassword?: () => void;
  onSignOut?: () => void;
}

export function TopBar({
  activeNav,
  userRole,
  departmentRole,
  onChangeDepartmentRole,
  notifiedIqcCount,
  iqcReleasedPutawayCount,
  onOpenMobileMenu,
  onSelectNav,
  onQuickScan,
  userName,
  userEmail,
  onOpenChangePassword,
  onSignOut,
}: TopBarProps) {
  const [scanInput, setScanInput] = useState('');
  const current = NAV_ITEMS.find((n) => n.key === activeNav) ?? NAV_ITEMS[0];
  const canSwitch = canSwitchDepartmentView(userRole);
  const isWarehouseRole = departmentRole === 'WAREHOUSE';
  const isPdaTaskPage = isWarehouseRole && activeNav !== 'userAdmin' && Boolean(current.isPdaTask);
  const deptMeta = DEPARTMENT_META[departmentRole];
  const userRoleMeta = USER_ROLE_META[userRole];
  const breadcrumbScope =
    activeNav === 'userAdmin'
      ? '系统管理'
      : canSwitch
        ? `管理员 · ${deptMeta.badge}`
        : userRoleMeta.badge;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    onQuickScan(scanInput.trim());
    setScanInput('');
  };

  const displayUser = userName || userEmail || '';

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200/90 bg-white/95 px-3 backdrop-blur-xs lg:h-16 lg:gap-6 lg:px-6">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        {isPdaTaskPage ? (
          <button
            type="button"
            onClick={() => onSelectNav('pdaHome')}
            aria-label="返回PDA作业菜单"
            className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-800 whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>PDA菜单</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="打开菜单"
            className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
          <span className="hidden whitespace-nowrap text-xs font-semibold text-teal-800 lg:inline">
            {breadcrumbScope}
          </span>
          <span className="hidden text-slate-300 lg:inline" aria-hidden="true">
            /
          </span>
          <h1 className="truncate font-display text-sm font-semibold text-slate-900 sm:text-base">
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
            className="w-full rounded-md border border-slate-200 bg-[#f8fafb] py-1.5 pl-9 pr-3 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/15"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-800"
        >
          扫码追溯
        </button>
      </form>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Mobile Department Switcher: ONLY visible to ADMIN. Regular staff see a static locked badge. */}
        {canSwitch ? (
          <div
            role="group"
            aria-label="移动端部门切换"
            className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 lg:hidden"
          >
            {DEPARTMENT_LIST.map((role) => {
              const meta = DEPARTMENT_META[role];
              const isSelected = role === departmentRole;
              const alertDot =
                (role === 'IQC' && notifiedIqcCount > 0) ||
                (role === 'WAREHOUSE' && iqcReleasedPutawayCount > 0);
              return (
                <button
                  key={role}
                  type="button"
                  aria-label={`切换到${meta.label}`}
                  aria-pressed={isSelected}
                  onClick={() => onChangeDepartmentRole(role)}
                  className={`relative min-h-[34px] rounded px-1.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {meta.shortLabel}
                  {alertDot && !isSelected && (
                    <span
                      className={`ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                        role === 'IQC' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <span
            data-testid="locked-role-badge"
            className={`inline-flex min-h-[32px] items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold whitespace-nowrap lg:hidden ${userRoleMeta.toneClass}`}
          >
            <Lock className="h-3 w-3 shrink-0" />
            <span>{userRoleMeta.shortLabel}</span>
          </span>
        )}

        {isPdaTaskPage && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="打开完整菜单"
            className="hidden min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 sm:flex lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        {isWarehouseRole &&
          activeNav !== 'pdaHome' &&
          activeNav !== 'userAdmin' &&
          !isPdaTaskPage && (
            <button
              type="button"
              onClick={() => onSelectNav('pdaHome')}
              className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-teal-800"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>PDA作业</span>
            </button>
          )}

        {displayUser && (
          <div className="hidden items-center gap-1.5 border-l border-slate-200 pl-3 text-xs text-slate-600 xl:flex">
            <UserCircle2 className="h-4 w-4 shrink-0 text-teal-700/80" />
            <span className="max-w-[120px] truncate font-medium text-slate-700" title={userEmail || displayUser}>
              {displayUser}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${userRoleMeta.toneClass}`}
            >
              {userRoleMeta.shortLabel}
            </span>
          </div>
        )}

        {onOpenChangePassword && (
          <button
            type="button"
            onClick={onOpenChangePassword}
            aria-label="修改密码"
            title="修改密码"
            className="hidden min-h-[38px] min-w-[38px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:inline-flex sm:px-2.5"
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
            className="inline-flex min-h-[38px] min-w-[38px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:px-2.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">退出</span>
          </button>
        )}
      </div>
    </header>
  );
}
