import type { AsnOrder, AsnWorkflowStage } from '../types/wms';
import type { NavKey } from '../components/Sidebar';
import { deriveAsnWorkflowStage } from './wmsLogic';

export type DepartmentRole = 'WAREHOUSE' | 'IQC' | 'PROCUREMENT';

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
};

export const DEPARTMENT_LIST: DepartmentRole[] = ['WAREHOUSE', 'IQC', 'PROCUREMENT'];

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
};

/**
 * Checks whether a given navigation page is strictly allowed under the active department role.
 * Enforces 3-way segregation of duties:
 * - Procurement owns ASN creation/import (`asnPlan`)
 * - Warehouse owns receiving, putaway, picking, and stock ops (never ASN creation or IQC)
 * - IQC owns independent quality inspection (`asnIqc`) (never warehouse or procurement ops)
 */
export function isNavAllowedForRole(role: DepartmentRole, nav: NavKey): boolean {
  return ROLE_ALLOWED_NAVS[role].has(nav);
}

/**
 * Resolves a requested navigation route into an authorized page for the active department role.
 */
export function resolveNavForRole(
  role: DepartmentRole,
  requestedNav: NavKey,
  isMobile: boolean
): NavKey {
  if (isNavAllowedForRole(role, requestedNav)) {
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
  if (fromMode === 'receive' && (targetStage === 'SUPPLIER_DELIVERY' || targetStage === 'ASN_REGISTERED')) {
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
 * - Warehouse Arrival: ASNs awaiting check-in (plus currently receiving for visibility).
 * - Warehouse Receiving (待收料清单): ASNs actively receiving or awaiting arrival, plus recently notified to IQC (read-only status).
 * - IQC Quality (IQC 待检清单): ONLY ASNs formally received & notified by Warehouse (`IQC_INSPECTION`), plus already-inspected history.
 * - Warehouse Putaway (IQC 已放行待入库清单): ONLY ASNs released by IQC with qualified qty (`PUTAWAY`), plus completed qualified receipts.
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
