import type {
  AsnStatus,
  BomItemRole,
  MaterialOwnershipType,
  MsdState,
  PackagingCarrierType,
  ReelItem,
  ReelStatus,
  TraceActionType,
  WorkOrderStatus,
} from '../types/wms';

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const OWNERSHIP_TYPE_LABEL: Record<
  MaterialOwnershipType,
  { label: string; short: string; toneClass: string }
> = {
  SELF_PURCHASED: { label: '本厂自购', short: '自购', toneClass: 'text-slate-700' },
  CUSTOMER_CONSIGNED: { label: '客户客供', short: '客供', toneClass: 'text-sky-700' },
  VMI_CONSIGNED: { label: 'VMI寄售', short: 'VMI', toneClass: 'text-amber-700' },
};

export const PACKAGING_CARRIER_LABEL: Record<PackagingCarrierType, string> = {
  REEL: 'SMT 载带卷盘 (Reel)',
  TRAY: 'JEDEC 托盘 (Tray)',
  TUBE: '料管 (Tube)',
  BAG_BOTTLE: '防潮袋/冷链瓶装',
  CUT_TAPE: '剪带散料 (Cut Tape)',
  BULK: '散装/整箱',
};

export const BOM_ROLE_LABEL: Record<
  BomItemRole,
  { label: string; toneClass: string }
> = {
  MAIN: { label: '通用主料', toneClass: 'text-slate-700' },
  SPECIAL_MAIN: { label: '机型特料', toneClass: 'text-sky-700' },
  SUBSTITUTE: { label: '替代料(代用)', toneClass: 'text-amber-700' },
};

export const ACTION_META: Record<
  TraceActionType,
  { label: string; toneClass: string }
> = {
  INBOUND: { label: '入库上架', toneClass: 'text-emerald-700' },
  WAVE_ALLOCATE: { label: '波次锁定', toneClass: 'text-sky-700' },
  WAVE_ISSUE: { label: '波次发料', toneClass: 'text-sky-800' },
  GENERAL_OUTBOUND: { label: '其他出库', toneClass: 'text-slate-700' },
  REPLENISH: { label: '生产补料', toneClass: 'text-amber-700' },
  RETURN: { label: '生产退料', toneClass: 'text-emerald-700' },
  MSD_BAKE: { label: 'MSD烘烤复位', toneClass: 'text-sky-700' },
  SCRAP: { label: '物料报废', toneClass: 'text-red-700' },
  CYCLE_COUNT: { label: '盘点调账', toneClass: 'text-amber-700' },
};

export const REEL_STATUS_LABEL: Record<ReelStatus, { label: string; toneClass: string }> = {
  IN_STOCK: { label: '在库可用', toneClass: 'text-emerald-700' },
  ALLOCATED: { label: '波次锁定', toneClass: 'text-sky-700' },
  ISSUED_TO_LINE: { label: '线边在制', toneClass: 'text-amber-700' },
  DEPLETED: { label: '已耗尽', toneClass: 'text-slate-500' },
  SCRAPPED: { label: '已报废', toneClass: 'text-red-700' },
};

export const MSD_STATE_LABEL: Record<MsdState, { label: string; toneClass: string }> = {
  SEALED: { label: '真空密封', toneClass: 'text-emerald-700' },
  EXPOSED: { label: '暴露计时中', toneClass: 'text-amber-700' },
  BAKING_REQUIRED: { label: '超时待烘烤', toneClass: 'text-red-700' },
};

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  PLANNED: '待排料',
  WAVED: '已建波次',
  ISSUING: '发料中',
  IN_PRODUCTION: '生产中',
  COMPLETED: '已完工',
};

export const ASN_STATUS_LABEL: Record<AsnStatus, { label: string; toneClass: string }> = {
  PENDING: { label: '待收料', toneClass: 'text-sky-700' },
  PARTIAL: { label: '部分收料', toneClass: 'text-amber-700' },
  COMPLETED: { label: '已完结', toneClass: 'text-emerald-700' },
  CANCELLED: { label: '已作废', toneClass: 'text-slate-400' },
};

export function buildCompositeBarcode(reel: ReelItem): string {
  return `UID:${reel.reelId}|P:${reel.mpn}|L:${reel.lotNumber}|D:${reel.dateCode}|Q:${reel.qty}`;
}

/**
 * Generates deterministic Code-128 style bar widths for clean SVG barcode rendering
 */
export function generateBarcodeBars(text: string): { x: number; width: number }[] {
  const bars: { x: number; width: number }[] = [];
  let cursor = 4;
  // Start guard
  bars.push({ x: cursor, width: 2 });
  cursor += 4;
  bars.push({ x: cursor, width: 1 });
  cursor += 3;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const w1 = ((code >> 0) & 1) + 1;
    const s1 = ((code >> 1) & 1) + 1;
    const w2 = ((code >> 2) & 2) ? 2 : 1;
    const s2 = ((code >> 3) & 1) + 1;
    const w3 = ((code >> 4) & 1) + 1;
    const s3 = ((code >> 5) & 1) + 1;

    bars.push({ x: cursor, width: w1 });
    cursor += w1 + s1;
    bars.push({ x: cursor, width: w2 });
    cursor += w2 + s2;
    bars.push({ x: cursor, width: w3 });
    cursor += w3 + s3;
  }

  // Stop guard
  bars.push({ x: cursor, width: 2 });
  cursor += 3;
  bars.push({ x: cursor, width: 2 });
  return bars;
}
