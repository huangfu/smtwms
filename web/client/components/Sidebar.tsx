import {
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Database,
  GitBranch,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  RotateCcw,
  ScanBarcode,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  canSwitchDepartmentView,
  DEPARTMENT_LIST,
  DEPARTMENT_META,
  isNavAllowedForRole,
  USER_ROLE_META,
  type DepartmentRole,
  type NavKey,
  type UserRole,
} from '../../shared/domain/roleAccess';

export type { NavKey };

export type NavGroupKey =
  | 'workspace'
  | 'pdaOps'
  | 'iqcOps'
  | 'procurementOps'
  | 'planning'
  | 'adminOps';

export interface NavItemDef {
  key: NavKey;
  label: string;
  shortLabel: string;
  sub: string;
  group: NavGroupKey;
  isPdaTask?: boolean;
  icon: typeof LayoutDashboard;
}

export const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  { key: 'workspace', label: '仓库工作台入口' },
  { key: 'pdaOps', label: '仓库 PDA 扫码作业' },
  { key: 'iqcOps', label: 'IQC 品质检验中心' },
  { key: 'procurementOps', label: '采购 ASN 预约与下发' },
  { key: 'planning', label: '计划排程与基础台账' },
  { key: 'adminOps', label: '系统管理' },
];

export const NAV_ITEMS: NavItemDef[] = [
  {
    key: 'pdaHome',
    label: 'PDA 作业菜单',
    shortLabel: 'PDA菜单',
    sub: '仓库手持端一功能一页入口',
    group: 'workspace',
    icon: LayoutGrid,
  },
  {
    key: 'dashboard',
    label: '仓储总览',
    shortLabel: '仓储总览',
    sub: '运营看板与异常预警',
    group: 'workspace',
    icon: LayoutDashboard,
  },

  // Warehouse Single-Function PDA Execution Pages (strictly NO ASN creation, NO IQC)
  {
    key: 'asnArrival',
    label: '1. 到货签到',
    shortLabel: '到货签到',
    sub: '核对供应商送货到厂登记',
    group: 'pdaOps',
    isPdaTask: true,
    icon: Truck,
  },
  {
    key: 'asnReceive',
    label: '2. 待收料初收',
    shortLabel: '待收料初收',
    sub: '扫箱码初收 · 完结通知IQC',
    group: 'pdaOps',
    isPdaTask: true,
    icon: ScanBarcode,
  },
  {
    key: 'asnPutaway',
    label: '3. 合格品入库上架',
    shortLabel: '入库上架',
    sub: 'IQC放行后绑库位 · 赋UID',
    group: 'pdaOps',
    isPdaTask: true,
    icon: PackageCheck,
  },
  {
    key: 'quickInbound',
    label: '无单急料入库',
    shortLabel: '急料入库',
    sub: '应急散料直扫赋码上架',
    group: 'pdaOps',
    isPdaTask: true,
    icon: PackagePlus,
  },
  {
    key: 'wavePick',
    label: '波次扫码发料',
    shortLabel: '波次发料',
    sub: 'FIFO防错扫料盘核销',
    group: 'pdaOps',
    isPdaTask: true,
    icon: Layers,
  },
  {
    key: 'replenish',
    label: 'SMT产线补料',
    shortLabel: '产线补料',
    sub: '抛料/断带紧急补领',
    group: 'pdaOps',
    isPdaTask: true,
    icon: ArrowUpRight,
  },
  {
    key: 'returnStock',
    label: '产线余料退库',
    shortLabel: '余料退库',
    sub: '点数回库/拆盘子UID',
    group: 'pdaOps',
    isPdaTask: true,
    icon: RotateCcw,
  },
  {
    key: 'cycleCount',
    label: '循环盘点扫码',
    shortLabel: '扫码盘点',
    sub: 'PDA扫料盘核对与调账',
    group: 'pdaOps',
    isPdaTask: true,
    icon: ClipboardCheck,
  },
  {
    key: 'scrap',
    label: '物料报废隔离',
    shortLabel: '报废隔离',
    sub: 'MRB评审隔离与核销',
    group: 'pdaOps',
    isPdaTask: true,
    icon: Trash2,
  },
  {
    key: 'generalOutbound',
    label: '其他领料出库',
    shortLabel: '其他出库',
    sub: '非工单/研发/试产领料',
    group: 'pdaOps',
    isPdaTask: true,
    icon: PackageMinus,
  },

  // Dedicated IQC Quality Inspection Page (ONLY visible under IQC role)
  {
    key: 'asnIqc',
    label: 'IQC 来料质检',
    shortLabel: 'IQC质检',
    sub: '接收仓库报检 · 合格/不良判定',
    group: 'iqcOps',
    icon: ShieldCheck,
  },

  // Dedicated Procurement ASN Management Page (ONLY visible under PROCUREMENT role)
  {
    key: 'asnPlan',
    label: '采购 ASN 预约管理',
    shortLabel: 'ASN预约',
    sub: '采购制单 / CSV导入下发仓库',
    group: 'procurementOps',
    icon: ClipboardList,
  },

  // Planning & Master Data Pages
  {
    key: 'wavePlan',
    label: '波次排产建单',
    shortLabel: '波次建单',
    sub: '合并工单FIFO锁盘',
    group: 'planning',
    icon: ArrowDownToLine,
  },
  {
    key: 'countPlan',
    label: '盘点任务建单',
    shortLabel: '盘点建单',
    sub: '按库区生成循环盘点单',
    group: 'planning',
    icon: SlidersHorizontal,
  },
  {
    key: 'trace',
    label: '全程扫码追溯',
    shortLabel: '扫码追溯',
    sub: 'UID/批次/工单正反查',
    group: 'planning',
    icon: ScanBarcode,
  },
  {
    key: 'bom',
    label: 'BOM清单与代用',
    shortLabel: 'BOM管理',
    sub: '机型特料/替代料单表',
    group: 'planning',
    icon: GitBranch,
  },
  {
    key: 'master',
    label: '基础档案与台账',
    shortLabel: '基础档案',
    sub: '物料/包装SPQ/规则/库位',
    group: 'planning',
    icon: Database,
  },

  // Admin-only RBAC & Account Management
  {
    key: 'userAdmin',
    label: '权限与账号管理',
    shortLabel: '账号权限',
    sub: '管理员开户 / 岗位角色分配',
    group: 'adminOps',
    icon: Shield,
  },
];

interface SidebarProps {
  active: NavKey;
  userRole: UserRole;
  departmentRole: DepartmentRole;
  onChangeDepartmentRole: (role: DepartmentRole) => void;
  queueCounts: {
    pendingArrivalCount: number;
    pendingReceiveCount: number;
    notifiedIqcCount: number;
    iqcReleasedPutawayCount: number;
  };
  onSelect: (key: NavKey) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  msdAlertCount: number;
}

export function Sidebar({
  active,
  userRole,
  departmentRole,
  onChangeDepartmentRole,
  queueCounts,
  onSelect,
  mobileOpen,
  onCloseMobile,
  msdAlertCount,
}: SidebarProps) {
  const activeDeptMeta = DEPARTMENT_META[departmentRole];
  const userRoleMeta = USER_ROLE_META[userRole];
  const canSwitch = canSwitchDepartmentView(userRole);
  const warehouseTodoCount =
    queueCounts.pendingArrivalCount +
    queueCounts.pendingReceiveCount +
    queueCounts.iqcReleasedPutawayCount;

  const getRoleBadgeCount = (role: DepartmentRole): number => {
    if (role === 'WAREHOUSE') return warehouseTodoCount;
    if (role === 'IQC') return queueCounts.notifiedIqcCount;
    return 0;
  };

  const navContent = (
    <div className="flex h-full flex-col border-r border-white/[0.08] bg-[#11161e] text-slate-100">
      <div className="flex h-14 items-center justify-between border-b border-white/[0.08] px-4 lg:h-16 lg:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-600 text-white shadow-xs">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="font-display text-[15px] font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            智造 SMT-WMS
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="关闭侧边导航"
          className="rounded-md p-2 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Department Role Panel: Switcher for ADMIN only, Locked Badge for regular staff */}
      <div className="border-b border-white/[0.08] bg-[#0d1118] px-3 py-3">
        {canSwitch ? (
          <>
            <div className="flex items-center justify-between px-1 text-[11px] font-medium text-slate-400">
              <span>管理员 · 视角切换预览</span>
              <span className="font-semibold text-teal-300">{activeDeptMeta.badge}</span>
            </div>
            <div
              role="group"
              aria-label="切换部门职权视角"
              className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-white/[0.05] p-1"
            >
              {DEPARTMENT_LIST.map((role) => {
                const meta = DEPARTMENT_META[role];
                const isSelected = role === departmentRole;
                const badgeCount = getRoleBadgeCount(role);
                return (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChangeDepartmentRole(role);
                      onCloseMobile();
                    }}
                    className={`flex min-h-[34px] items-center justify-center gap-1 rounded px-1.5 py-1 text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span>{meta.shortLabel}</span>
                    {badgeCount > 0 && (
                      <span
                        className={`font-mono text-[10px] tabular-nums ${
                          isSelected
                            ? 'text-teal-100'
                            : role === 'IQC'
                              ? 'text-amber-300'
                              : 'text-teal-300'
                        }`}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3 text-teal-400" />
                当前岗位权限
              </span>
              <span className="font-semibold text-teal-300">{userRoleMeta.badge}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">{userRoleMeta.label}</span>
              <span className="text-[10px] text-slate-400">本部门视角锁定</span>
            </div>
          </div>
        )}
      </div>

      <nav
        aria-label="主导航"
        className="mes-rail-scroll flex-1 space-y-5 overflow-y-auto px-3 py-4"
      >
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter(
            (i) => i.group === group.key && isNavAllowedForRole(departmentRole, i.key, userRole)
          );
          if (items.length === 0) return null;
          const groupLabel =
            group.key === 'pdaOps' && departmentRole === 'PRODUCTION'
              ? 'SMT 产线扫码作业'
              : group.label;
          return (
            <div key={group.key}>
              <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-slate-400">
                {groupLabel}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.key;
                  const itemCount =
                    item.key === 'asnArrival'
                      ? queueCounts.pendingArrivalCount
                      : item.key === 'asnReceive'
                        ? queueCounts.pendingReceiveCount
                        : item.key === 'asnIqc'
                          ? queueCounts.notifiedIqcCount
                          : item.key === 'asnPutaway'
                            ? queueCounts.iqcReleasedPutawayCount
                            : item.key === 'master'
                              ? msdAlertCount
                              : 0;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        onSelect(item.key);
                        onCloseMobile();
                      }}
                      className={`group flex min-h-[42px] w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-all duration-150 ${
                        isActive
                          ? 'bg-teal-500/15 text-white ring-1 ring-inset ring-teal-400/25'
                          : 'text-slate-200 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-teal-300'
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold tracking-[0.01em] whitespace-nowrap">
                            {item.label}
                          </span>
                          {itemCount > 0 && (
                            <span
                              className={`font-mono text-xs font-semibold tabular-nums ${
                                item.key === 'master'
                                  ? 'text-red-400'
                                  : item.key === 'asnIqc'
                                    ? 'text-amber-300'
                                    : item.key === 'asnPutaway'
                                      ? 'text-emerald-300'
                                      : 'text-teal-300'
                              }`}
                            >
                              {itemCount}
                            </span>
                          )}
                        </div>
                        <div
                          className={`truncate text-[11px] ${
                            isActive ? 'text-teal-200/85' : 'text-slate-400/80 group-hover:text-slate-300'
                          }`}
                        >
                          {item.sub}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.08] bg-[#0d1118] px-4 py-3 text-xs text-slate-400">
        <div className="font-medium text-slate-200">
          {canSwitch
            ? `系统管理员 · 预览 ${activeDeptMeta.badge}`
            : `${userRoleMeta.label} · 职权隔离模式`}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-500">
          采购 → 仓库初收 → IQC → 入库 · 产线补退料
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{navContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-64 max-w-[82vw]">{navContent}</aside>
        </div>
      )}
    </>
  );
}
