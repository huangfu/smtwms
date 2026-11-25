import type { AsnOrder, AsnWorkflowStage } from '../types/wms';
import { deriveAsnWorkflowStage } from './wmsLogic';

export type NavKey =
  | 'pdaHome'
  | 'dashboard'
  | 'asnArrival'
  | 'asnReceive'
  | 'asnIqc'
  | 'asnPutaway'
  | 'quickInbound'
  | 'wavePick'
  | 'replenish'
  | 'returnStock'
  | 'cycleCount'
  | 'scrap'
  | 'generalOutbound'
  | 'asnPlan'
  | 'wavePlan'
  | 'countPlan'
  | 'trace'
  | 'bom'
  | 'master'
  | 'userAdmin';

export type DepartmentRole = 'WAREHOUSE' | 'IQC' | 'PROCUREMENT' | 'PRODUCTION';
export type UserRole = 'ADMIN' | DepartmentRole;
export type UserStatus = 'ACTIVE' | 'DISABLED';

export type WorkbenchPageMode = 'arrival' | 'receive' | 'iqc' | 'putaway';

export interface DepartmentMeta {
  role: DepartmentRole;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  defaultDesktopNav: NavKey;
  defaultMobileNav: NavKey;
}

export interface UserRoleMeta {
  role: UserRole;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  toneClass: string;
}

export const DEPARTMENT_META: Record<DepartmentRole, DepartmentMeta> = {
  WAREHOUSE: {
    role: 'WAREHOUSE',
    label: '仓库作业',
    shortLabel: '仓库',
    badge: '仓储部',
    description: '到货签到、待收料初收（通知IQC）、IQC放行入库上架、波次发料与在库管控',
    defaultDesktopNav: 'dashboard',
    defaultMobileNav: 'pdaHome',
  },
  IQC: {
    role: 'IQC',
    label: 'IQC 品质部',
    shortLabel: 'IQC',
    badge: '品质部',
    description: '独立接收仓库报检通知，执行来料抽检合格放行或不良隔离判定',
    defaultDesktopNav: 'asnIqc',
    defaultMobileNav: 'asnIqc',
  },
  PROCUREMENT: {
    role: 'PROCUREMENT',
    label: '采购部',
    shortLabel: '采购',
    badge: '采购部',
    description: '维护采购 ASN 到货预约、导入供应商送货清单并追踪到货与入库进度',
    defaultDesktopNav: 'asnPlan',
    defaultMobileNav: 'asnPlan',
  },
  PRODUCTION: {
    role: 'PRODUCTION',
    label: '生产部',
    shortLabel: '生产',
    badge: '生产部',
    description: 'SMT 产线扫码补料、产线余料点数退库（拆盘子 UID）与全程扫码追溯',
    defaultDesktopNav: 'replenish',
    defaultMobileNav: 'replenish',
  },
};

export const USER_ROLE_META: Record<UserRole, UserRoleMeta> = {
  ADMIN: {
    role: 'ADMIN',
    label: '系统管理员',
    shortLabel: '管理员',
    badge: '管理员',
    description: '拥有全部菜单权限、账号与岗位角色管理权，并可切换预览各部门作业视角',
    toneClass: 'border-slate-300 bg-slate-100 text-slate-800',
  },
  WAREHOUSE: {
    role: 'WAREHOUSE',
    label: '仓库员',
    shortLabel: '仓库',
    badge: '仓储部',
    description: '锁定仓库视角：到货签到、待收料初收、IQC放行入库、发料补退料与在库盘点',
    toneClass: 'border-teal-200 bg-teal-50 text-teal-800',
  },
  IQC: {
    role: 'IQC',
    label: 'IQC 质检员',
    shortLabel: 'IQC',
    badge: '品质部',
    description: '锁定 IQC 视角：来料质检合格放行/不良隔离判定与全程扫码追溯',
    toneClass: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  PROCUREMENT: {
    role: 'PROCUREMENT',
    label: '采购员',
    shortLabel: '采购',
    badge: '采购部',
    description: '锁定采购视角：采购 ASN 预约制单、CSV 导入、履约进度追踪与基础档案',
    toneClass: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  },
  PRODUCTION: {
    role: 'PRODUCTION',
    label: '生产员',
    shortLabel: '生产',
    badge: '生产部',
    description: '锁定生产视角：SMT 产线补料、产线余料退库与全程扫码追溯（与仓库共享补退料权限）',
    toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
};

export const DEPARTMENT_LIST: DepartmentRole[] = [
  'WAREHOUSE',
  'IQC',
  'PROCUREMENT',
  'PRODUCTION',
];
export const USER_ROLE_LIST: UserRole[] = [
  'ADMIN',
  'WAREHOUSE',
  'IQC',
  'PROCUREMENT',
  'PRODUCTION',
];

export function normalizeUserRole(raw: unknown): UserRole {
  if (
    raw === 'ADMIN' ||
    raw === 'WAREHOUSE' ||
    raw === 'IQC' ||
    raw === 'PROCUREMENT' ||
    raw === 'PRODUCTION'
  ) {
    return raw;
  }
  return 'WAREHOUSE';
}

export function normalizeUserStatus(raw: unknown): UserStatus {
  if (raw === 'ACTIVE' || raw === 'DISABLED') {
    return raw;
  }
  return 'ACTIVE';
}

/**
 * Only system administrators may freely switch between Warehouse / IQC / Procurement preview views.
 * Regular staff accounts are strictly locked to their assigned department perspective.
 */
export function canSwitchDepartmentView(userRole: UserRole): boolean {
  return userRole === 'ADMIN';
}

/**
 * Only system administrators may access User & Role Management.
 */
export function canManageUsers(userRole: UserRole): boolean {
  return userRole === 'ADMIN';
}

/**
 * Resolves the effective department view for the signed-in user.
 * - Regular staff (`WAREHOUSE` / `IQC` / `PROCUREMENT`): strictly locked to their own role.
 * - `ADMIN`: uses the chosen preview department (`WAREHOUSE` / `IQC` / `PROCUREMENT`).
 */
export function resolveEffectiveDepartmentRole(
  userRole: UserRole,
  previewDepartment: DepartmentRole
): DepartmentRole {
  if (userRole === 'ADMIN') {
    return previewDepartment;
  }
  return userRole;
}

/**
 * Server-side RBAC check: returns true if the user's role is included in allowedRoles.
 */
export function isApiRoleAllowed(
  userRole: UserRole,
  allowedRoles: readonly UserRole[]
): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Validates admin user mutations to prevent accidental lockouts:
 * 1. An admin cannot disable their own account.
 * 2. The last remaining active admin cannot be demoted or disabled.
 */
export function validateUserAdminMutation(input: {
  actorUid: string;
  targetUid: string;
  currentRole: UserRole;
  currentStatus: UserStatus;
  nextRole: UserRole;
  nextStatus: UserStatus;
  activeAdminCount: number;
}): string | null {
  if (input.actorUid === input.targetUid && input.nextStatus === 'DISABLED') {
    return '不能停用当前正在登录的管理员账号，请使用其他管理员账号操作。';
  }
  const wasActiveAdmin =
    input.currentRole === 'ADMIN' && input.currentStatus === 'ACTIVE';
  const remainsActiveAdmin =
    input.nextRole === 'ADMIN' && input.nextStatus === 'ACTIVE';

  if (wasActiveAdmin && !remainsActiveAdmin && input.activeAdminCount <= 1) {
    return '系统至少需保留 1 位活跃的系统管理员，无法降级或停用最后一位管理员。';
  }
  return null;
}

export type MasterTabKey =
  | 'reels'
  | 'materials'
  | 'packaging'
  | 'barcodeRules'
  | 'warehouse'
  | 'partners'
  | 'workOrders';

export const MASTER_TAB_EDIT_ROLES: Record<MasterTabKey, readonly UserRole[]> = {
  reels: ['WAREHOUSE', 'ADMIN'],
  materials: ['WAREHOUSE', 'ADMIN'],
  packaging: ['WAREHOUSE', 'ADMIN'],
  barcodeRules: ['WAREHOUSE', 'ADMIN'],
  warehouse: ['WAREHOUSE', 'ADMIN'],
  partners: ['PROCUREMENT', 'ADMIN'],
  workOrders: ['PRODUCTION', 'WAREHOUSE', 'ADMIN'],
};

export const MASTER_TAB_OWNER_LABEL: Record<MasterTabKey, string> = {
  reels: '仓库员 / 系统管理员',
  materials: '仓库员 / 系统管理员',
  packaging: '仓库员 / 系统管理员',
  barcodeRules: '仓库员 / 系统管理员',
  warehouse: '仓库员 / 系统管理员',
  partners: '采购员 / 系统管理员',
  workOrders: '生产员 / 仓库员 / 系统管理员',
};

/**
 * Tab-level Read vs. Edit RBAC inside「基础档案与台账」:
 * - PROCUREMENT: ONLY `partners` (供应商与客户管理) is editable; all other 6 tabs are strictly read-only.
 * - WAREHOUSE: edits `reels` (MSD bake), `materials`, `packaging`, `barcodeRules`, `warehouse`, `workOrders`; `partners` is strictly read-only.
 * - PRODUCTION: ONLY `workOrders` is editable; all other 6 tabs are strictly read-only.
 * - IQC: strictly read-only across all master data tabs.
 * - ADMIN: full edit rights across all 7 tabs.
 */
export function canEditMasterTab(userRole: UserRole, tab: MasterTabKey): boolean {
  return MASTER_TAB_EDIT_ROLES[tab].includes(userRole);
}

/**
 * Picks the most relevant landing tab inside「基础档案与台账」for each department role.
 */
export function getDefaultMasterTab(role: UserRole): MasterTabKey {
  if (role === 'PROCUREMENT') return 'partners';
  if (role === 'PRODUCTION') return 'workOrders';
  return 'reels';
}

const ROLE_ALLOWED_NAVS: Record<DepartmentRole, ReadonlySet<NavKey>> = {
  WAREHOUSE: new Set<NavKey>([
    'pdaHome',
    'dashboard',
    'asnArrival',
    'asnReceive',
    'asnPutaway',
    'quickInbound',
    'wavePick',
    'replenish',
    'returnStock',
    'cycleCount',
    'scrap',
    'generalOutbound',
    'wavePlan',
    'countPlan',
    'trace',
    'bom',
    'master',
  ]),
  IQC: new Set<NavKey>(['asnIqc', 'trace']),
  PROCUREMENT: new Set<NavKey>(['asnPlan', 'trace', 'master']),
  PRODUCTION: new Set<NavKey>(['replenish', 'returnStock', 'trace', 'master']),
};

/**
 * Checks whether a given navigation page is strictly allowed under the active department role
 * (and optional authenticated UserRole for admin-only pages like `userAdmin`).
 */
export function isNavAllowedForRole(
  role: DepartmentRole,
  nav: NavKey,
  userRole?: UserRole
): boolean {
  if (nav === 'userAdmin') {
    return userRole === 'ADMIN';
  }
  return ROLE_ALLOWED_NAVS[role].has(nav);
}

/**
 * Resolves a requested navigation route into an authorized page for the active department role.
 */
export function resolveNavForRole(
  role: DepartmentRole,
  requestedNav: NavKey,
  isMobile: boolean,
  userRole?: UserRole
): NavKey {
  if (isNavAllowedForRole(role, requestedNav, userRole)) {
    return requestedNav;
  }
  const meta = DEPARTMENT_META[role];
  return isMobile ? meta.defaultMobileNav : meta.defaultDesktopNav;
}

/**
 * Segregation-of-duties guard for cross-stage navigation.
 * Only intra-department stage transitions may jump directly between pages:
 * - Warehouse: arrival -> RECEIVING (`asnReceive`) is allowed.
 * - Warehouse <-> IQC transitions (`receive -> IQC_INSPECTION`, `iqc -> PUTAWAY`, etc.)
 *   are strictly forbidden and must use asynchronous handoff notifications instead.
 */
export function canCrossNavigateStage(
  fromMode: WorkbenchPageMode,
  targetStage: AsnWorkflowStage
): boolean {
  if (fromMode === 'arrival' && targetStage === 'RECEIVING') {
    return true;
  }
  if (
    fromMode === 'receive' &&
    (targetStage === 'SUPPLIER_DELIVERY' || targetStage === 'ASN_REGISTERED')
  ) {
    return true;
  }
  return false;
}

/**
 * Counts active cross-department handoff queue items from persisted ASN workflow stages.
 */
export function getCrossDepartmentQueueCounts(asns: AsnOrder[]): {
  pendingArrivalCount: number;
  pendingReceiveCount: number;
  notifiedIqcCount: number;
  iqcReleasedPutawayCount: number;
} {
  let pendingArrivalCount = 0;
  let pendingReceiveCount = 0;
  let notifiedIqcCount = 0;
  let iqcReleasedPutawayCount = 0;

  for (const asn of asns) {
    if (asn.status === 'CANCELLED') continue;
    const stage = deriveAsnWorkflowStage(asn);
    if (stage === 'SUPPLIER_DELIVERY' || stage === 'ASN_REGISTERED') {
      pendingArrivalCount += 1;
    } else if (stage === 'RECEIVING') {
      pendingReceiveCount += 1;
    } else if (stage === 'IQC_INSPECTION') {
      notifiedIqcCount += 1;
    } else if (stage === 'PUTAWAY') {
      iqcReleasedPutawayCount += 1;
    }
  }

  return {
    pendingArrivalCount,
    pendingReceiveCount,
    notifiedIqcCount,
    iqcReleasedPutawayCount,
  };
}

/**
 * Filters and ranks ASNs strictly scoped to each department's workbench queue.
 */
export function getDepartmentAsns(
  asns: AsnOrder[],
  pageMode: WorkbenchPageMode
): AsnOrder[] {
  const nonCancelled = asns.filter((a) => a.status !== 'CANCELLED');

  if (pageMode === 'arrival') {
    return nonCancelled
      .filter((a) => {
        const st = deriveAsnWorkflowStage(a);
        return st === 'SUPPLIER_DELIVERY' || st === 'ASN_REGISTERED' || st === 'RECEIVING';
      })
      .sort((a, b) => {
        const ra = deriveAsnWorkflowStage(a) === 'RECEIVING' ? 1 : 0;
        const rb = deriveAsnWorkflowStage(b) === 'RECEIVING' ? 1 : 0;
        if (ra !== rb) return ra - rb;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  if (pageMode === 'receive') {
    const rank = (asn: AsnOrder): number => {
      const st = deriveAsnWorkflowStage(asn);
      if (st === 'RECEIVING') return 0;
      if (st === 'SUPPLIER_DELIVERY' || st === 'ASN_REGISTERED') return 1;
      return 2;
    };
    return nonCancelled
      .filter((a) => {
        const st = deriveAsnWorkflowStage(a);
        return (
          st === 'RECEIVING' ||
          st === 'SUPPLIER_DELIVERY' ||
          st === 'ASN_REGISTERED' ||
          st === 'IQC_INSPECTION'
        );
      })
      .sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  if (pageMode === 'iqc') {
    const rank = (asn: AsnOrder): number => {
      const st = deriveAsnWorkflowStage(asn);
      if (st === 'IQC_INSPECTION') return 0;
      return 1;
    };
    return nonCancelled
      .filter((a) => {
        const st = deriveAsnWorkflowStage(a);
        return (
          st === 'IQC_INSPECTION' ||
          st === 'PUTAWAY' ||
          st === 'INVENTORY_UPDATED' ||
          st === 'INFO_SYNCED'
        );
      })
      .sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  // pageMode === 'putaway' (Warehouse Putaway: strictly IQC-released qualified lots)
  const rank = (asn: AsnOrder): number => {
    const st = deriveAsnWorkflowStage(asn);
    if (st === 'PUTAWAY') return 0;
    return 1;
  };
  return nonCancelled
    .filter((a) => {
      const st = deriveAsnWorkflowStage(a);
      if (st === 'PUTAWAY') return true;
      if (st === 'INVENTORY_UPDATED' || st === 'INFO_SYNCED') {
        return a.lines.some((l) => (l.iqcPassedQty ?? 0) > 0);
      }
      return false;
    })
    .sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return b.createdAt.localeCompare(a.createdAt);
    });
}
