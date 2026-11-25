import type {
  AsnStatus,
  AsnWorkflowStage,
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
  CUSTOMER_CONSIGNED: { label: '客户客供', short: '客供', toneClass: 'text-teal-700' },
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
  SPECIAL_MAIN: { label: '机型特料', toneClass: 'text-teal-700' },
  SUBSTITUTE: { label: '替代料(代用)', toneClass: 'text-amber-700' },
};

export const ACTION_META: Record<
  TraceActionType,
  { label: string; toneClass: string }
> = {
  INBOUND: { label: '入库上架', toneClass: 'text-emerald-700' },
  WAVE_ALLOCATE: { label: '波次锁定', toneClass: 'text-teal-700' },
  WAVE_ISSUE: { label: '波次发料', toneClass: 'text-teal-800' },
  GENERAL_OUTBOUND: { label: '其他出库', toneClass: 'text-slate-700' },
  REPLENISH: { label: '生产补料', toneClass: 'text-amber-700' },
  RETURN: { label: '生产退料', toneClass: 'text-emerald-700' },
  MSD_BAKE: { label: 'MSD烘烤复位', toneClass: 'text-teal-700' },
  SCRAP: { label: '物料报废', toneClass: 'text-red-700' },
  CYCLE_COUNT: { label: '盘点调账', toneClass: 'text-amber-700' },
};

export const REEL_STATUS_LABEL: Record<ReelStatus, { label: string; toneClass: string }> = {
  IN_STOCK: { label: '在库可用', toneClass: 'text-emerald-700' },
  ALLOCATED: { label: '波次锁定', toneClass: 'text-teal-700' },
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
  PENDING: { label: '待收料', toneClass: 'text-teal-700' },
  PARTIAL: { label: '作业中', toneClass: 'text-amber-700' },
  COMPLETED: { label: '已完结', toneClass: 'text-emerald-700' },
  CANCELLED: { label: '已作废', toneClass: 'text-slate-400' },
};

export const ASN_WORKFLOW_STAGES: {
  key: AsnWorkflowStage;
  step: number;
  label: string;
  shortLabel: string;
  desc: string;
}[] = [
  {
    key: 'SUPPLIER_DELIVERY',
    step: 1,
    label: '供应商送货',
    shortLabel: '送货',
    desc: '送货单签到与月台收货核对',
  },
  {
    key: 'ASN_REGISTERED',
    step: 2,
    label: '预约登记(ASN)',
    shortLabel: '预约ASN',
    desc: '关联PO预约清单与预计到货明细',
  },
  {
    key: 'RECEIVING',
    step: 3,
    label: '收料登记',
    shortLabel: '收料登记',
    desc: '扫箱码核收数量，全部收齐后自动转IQC质检',
  },
  {
    key: 'IQC_INSPECTION',
    step: 4,
    label: 'IQC质检',
    shortLabel: 'IQC质检',
    desc: '收料登记完成后执行来料合格/不良判定',
  },
  {
    key: 'PUTAWAY',
    step: 5,
    label: '入库上架',
    shortLabel: '入库上架',
    desc: 'IQC合格品绑定目标库位并赋料盘UID',
  },
  {
    key: 'INVENTORY_UPDATED',
    step: 6,
    label: '库存更新',
    shortLabel: '库存更新',
    desc: '在库台账与批次周期库存实时入账',
  },
  {
    key: 'INFO_SYNCED',
    step: 7,
    label: '信息同步',
    shortLabel: '信息同步',
    desc: '追溯流水与ERP/MES收料信息同步回传',
  },
];

export const ASN_STAGE_META: Record<
  AsnWorkflowStage,
  { step: number; label: string; toneClass: string }
> = {
  SUPPLIER_DELIVERY: { step: 1, label: '供应商送货', toneClass: 'text-slate-700' },
  ASN_REGISTERED: { step: 2, label: '预约登记(ASN)', toneClass: 'text-teal-700' },
  RECEIVING: { step: 3, label: '收料登记', toneClass: 'text-teal-700' },
  IQC_INSPECTION: { step: 4, label: 'IQC质检', toneClass: 'text-amber-700' },
  PUTAWAY: { step: 5, label: '入库上架', toneClass: 'text-teal-700' },
  INVENTORY_UPDATED: { step: 6, label: '库存更新', toneClass: 'text-emerald-700' },
  INFO_SYNCED: { step: 7, label: '信息同步', toneClass: 'text-emerald-700' },
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
