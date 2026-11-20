import type {
  AsnLine,
  AsnOrder,
  BarcodeRule,
  BomItem,
  BomMaster,
  Customer,
  CycleCountTask,
  LabelTemplate,
  MaterialOwnershipType,
  MaterialSku,
  MsdLevel,
  PackagingSpec,
  ReelItem,
  ScrapRecord,
  Supplier,
  TraceEvent,
  Warehouse,
  WarehouseBin,
  WarehouseKeeper,
  WaveAllocation,
  WaveOrder,
  WmsState,
  WorkOrder,
  ZebraPrinterConfig,
} from '../types/wms';
import {
  DEFAULT_ELEMENT_ORDER,
  normalizeDpi,
  normalizeElementLayouts,
  normalizeElementOrder,
} from './zplEngine';

export function buildMaterialKey(
  skuCode: string,
  ownershipType: MaterialOwnershipType = 'SELF_PURCHASED',
  ownerCode = 'INTERNAL',
  customerCode = ''
): string {
  const cleanSku = skuCode.trim().toUpperCase();
  const cleanOwner =
    ownershipType === 'SELF_PURCHASED'
      ? 'INTERNAL'
      : (ownerCode.trim() || 'UNSPECIFIED').toUpperCase();
  const cleanCustomer =
    ownershipType === 'CUSTOMER_CONSIGNED'
      ? cleanOwner
      : customerCode.trim().toUpperCase() || 'COMMON';
  return `${cleanSku}::${ownershipType}::${cleanOwner}::${cleanCustomer}`;
}

export function getReelCustomerScope(reel: Pick<ReelItem, 'customerCode' | 'ownershipType' | 'ownerCode'>): string {
  const cus = reel.customerCode?.trim().toUpperCase() ?? '';
  if (cus && cus !== 'COMMON') return cus;
  if (reel.ownershipType === 'CUSTOMER_CONSIGNED') {
    return (reel.ownerCode?.trim() ?? '').toUpperCase();
  }
  return '';
}

export function isReelEligibleForCustomer(
  reel: Pick<ReelItem, 'customerCode' | 'ownershipType' | 'ownerCode'>,
  targetCustomerCode?: string
): boolean {
  const reelCus = getReelCustomerScope(reel);
  if (!reelCus) return true; // 通用共享物料，所有客户工单均可发料
  const target = (targetCustomerCode ?? '').trim().toUpperCase();
  return Boolean(target) && reelCus === target;
}

export function normalizeWmsState(
  raw: Partial<WmsState>,
  fallbackSeed: WmsState
): WmsState {
  const seedBinsByCode = new Map(fallbackSeed.bins.map((b) => [b.binCode, b]));
  const rawBins = Array.isArray(raw.bins) ? raw.bins : fallbackSeed.bins;
  const bins: WarehouseBin[] = rawBins.map((b) => {
    const seedMatch = seedBinsByCode.get(b.binCode);
    return {
      ...b,
      warehouseCode: b.warehouseCode ?? seedMatch?.warehouseCode ?? 'WH-SMT-01',
      keeperName: b.keeperName ?? seedMatch?.keeperName,
    };
  });

  const rawCustomers =
    Array.isArray(raw.customers) && raw.customers.length > 0
      ? raw.customers
      : fallbackSeed.customers;

  const seedMatBySku = new Map(fallbackSeed.materials.map((m) => [m.skuCode, m]));
  const rawMaterials = Array.isArray(raw.materials)
    ? raw.materials
    : fallbackSeed.materials;
  const materials: MaterialSku[] = rawMaterials.map((m) => {
    const seedMatch = seedMatBySku.get(m.skuCode);
    const ownershipType: MaterialOwnershipType =
      m.ownershipType ?? seedMatch?.ownershipType ?? 'SELF_PURCHASED';
    const ownerCode =
      m.ownerCode ??
      seedMatch?.ownerCode ??
      (ownershipType === 'SELF_PURCHASED' ? 'INTERNAL' : '');
    const ownerName =
      m.ownerName ??
      seedMatch?.ownerName ??
      (ownershipType === 'SELF_PURCHASED' ? '本厂自购' : ownerCode);
    const customerCode =
      ownershipType === 'CUSTOMER_CONSIGNED'
        ? ownerCode
        : (m.customerCode ?? seedMatch?.customerCode ?? '').trim().toUpperCase();
    const matchedCus = customerCode
      ? rawCustomers.find((c) => c.customerCode.toUpperCase() === customerCode)
      : undefined;
    const customerName = customerCode
      ? matchedCus?.customerName ?? m.customerName ?? seedMatch?.customerName ?? customerCode
      : '通用共享 (不限客户)';
    const computedKey = buildMaterialKey(m.skuCode, ownershipType, ownerCode, customerCode);
    const materialKey =
      m.materialKey && m.materialKey.split('::').length >= 4
        ? m.materialKey
        : computedKey;
    return {
      ...m,
      ownershipType,
      ownerCode,
      ownerName,
      customerCode,
      customerName,
      materialKey,
      packagingCode: m.packagingCode ?? seedMatch?.packagingCode,
      packagingName: m.packagingName ?? seedMatch?.packagingName ?? m.packageType,
      mpq: m.mpq ?? seedMatch?.mpq,
      supplierCode: m.supplierCode ?? seedMatch?.supplierCode,
      supplierName: m.supplierName ?? seedMatch?.supplierName,
    };
  });

  const rawBoms =
    Array.isArray(raw.boms) && raw.boms.length > 0 ? raw.boms : fallbackSeed.boms;
  const boms: BomMaster[] = rawBoms.map((b) => ({
    ...b,
    items: (b.items ?? []).map((item, idx) => ({
      ...item,
      lineId: item.lineId ?? `${b.bomId}-L${idx + 1}`,
      itemRole: item.itemRole ?? 'MAIN',
    })),
  }));

  const matByKey = new Map(materials.map((m) => [m.materialKey!, m]));
  const rawReels = Array.isArray(raw.reels) ? raw.reels : fallbackSeed.reels;
  const reels: ReelItem[] = rawReels.map((r) => {
    const matchedMat =
      (r.materialKey ? matByKey.get(r.materialKey) : undefined) ??
      materials.find((m) => m.skuCode === r.skuCode);
    const ownershipType = r.ownershipType ?? matchedMat?.ownershipType ?? 'SELF_PURCHASED';
    const ownerCode = r.ownerCode ?? matchedMat?.ownerCode ?? 'INTERNAL';
    const ownerName = r.ownerName ?? matchedMat?.ownerName ?? '本厂自购';
    const customerCode =
      ownershipType === 'CUSTOMER_CONSIGNED'
        ? ownerCode
        : (r.customerCode ?? matchedMat?.customerCode ?? '');
    const customerName =
      r.customerName ??
      (customerCode
        ? rawCustomers.find((c) => c.customerCode === customerCode)?.customerName ??
          matchedMat?.customerName ??
          customerCode
        : '通用共享 (不限客户)');
    return {
      ...r,
      ownershipType,
      ownerCode,
      ownerName,
      customerCode,
      customerName,
    };
  });

  const seedTplById = new Map(fallbackSeed.labelTemplates.map((t) => [t.templateId, t]));
  const rawTemplates =
    Array.isArray(raw.labelTemplates) && raw.labelTemplates.length > 0
      ? raw.labelTemplates
      : fallbackSeed.labelTemplates;
  const labelTemplates: LabelTemplate[] = rawTemplates.map((t) => {
    const seedTpl = seedTplById.get(t.templateId);
    const merged: LabelTemplate = {
      ...t,
      customWidthMm:
        typeof t.customWidthMm === 'number' && Number.isFinite(t.customWidthMm)
          ? Math.max(20, Math.min(200, t.customWidthMm))
          : seedTpl?.customWidthMm,
      customHeightMm:
        typeof t.customHeightMm === 'number' && Number.isFinite(t.customHeightMm)
          ? Math.max(10, Math.min(200, t.customHeightMm))
          : seedTpl?.customHeightMm,
      dpi: normalizeDpi(t.dpi ?? seedTpl?.dpi ?? 203),
      offsetXMm:
        typeof t.offsetXMm === 'number' && Number.isFinite(t.offsetXMm)
          ? Math.max(-30, Math.min(30, t.offsetXMm))
          : seedTpl?.offsetXMm ?? 0,
      offsetYMm:
        typeof t.offsetYMm === 'number' && Number.isFinite(t.offsetYMm)
          ? Math.max(-30, Math.min(30, t.offsetYMm))
          : seedTpl?.offsetYMm ?? 0,
      barcodeType: t.barcodeType ?? seedTpl?.barcodeType ?? 'CODE128',
      zplMode: t.zplMode ?? seedTpl?.zplMode ?? 'VISUAL',
      fontScale: t.fontScale ?? seedTpl?.fontScale ?? 'STANDARD',
      barcodeHeightMm: t.barcodeHeightMm ?? seedTpl?.barcodeHeightMm ?? 8,
      elementOrder: normalizeElementOrder(t.elementOrder ?? seedTpl?.elementOrder ?? DEFAULT_ELEMENT_ORDER),
      elementLayouts: t.elementLayouts ?? seedTpl?.elementLayouts,
      customZpl: t.customZpl ?? seedTpl?.customZpl ?? '',
    };
    return {
      ...merged,
      elementLayouts: normalizeElementLayouts(merged),
    };
  });

  const fallbackPrinter: ZebraPrinterConfig = fallbackSeed.printerConfig ?? {
    mode: 'LAN_TCP',
    host: '192.168.10.88',
    port: 9100,
    browserPrintUrl: 'http://127.0.0.1:9100',
    selectedDeviceName: '',
    darkness: 18,
    printSpeed: 4,
  };
  const rawPrinter = raw.printerConfig;
  const printerConfig: ZebraPrinterConfig = {
    mode: rawPrinter?.mode ?? fallbackPrinter.mode,
    host: rawPrinter?.host?.trim() || fallbackPrinter.host,
    port:
      typeof rawPrinter?.port === 'number' && rawPrinter.port >= 1 && rawPrinter.port <= 65535
        ? rawPrinter.port
        : fallbackPrinter.port,
    browserPrintUrl: rawPrinter?.browserPrintUrl?.trim() || fallbackPrinter.browserPrintUrl,
    selectedDeviceName: rawPrinter?.selectedDeviceName ?? fallbackPrinter.selectedDeviceName,
    darkness:
      typeof rawPrinter?.darkness === 'number' && rawPrinter.darkness >= 0 && rawPrinter.darkness <= 30
        ? rawPrinter.darkness
        : fallbackPrinter.darkness,
    printSpeed:
      typeof rawPrinter?.printSpeed === 'number' && rawPrinter.printSpeed >= 2 && rawPrinter.printSpeed <= 12
        ? rawPrinter.printSpeed
        : fallbackPrinter.printSpeed,
  };

  return {
    printerConfig,
    warehouses:
      Array.isArray(raw.warehouses) && raw.warehouses.length > 0
        ? raw.warehouses
        : fallbackSeed.warehouses,
    keepers:
      Array.isArray(raw.keepers) && raw.keepers.length > 0
        ? raw.keepers
        : fallbackSeed.keepers,
    suppliers:
      Array.isArray(raw.suppliers) && raw.suppliers.length > 0
        ? raw.suppliers
        : fallbackSeed.suppliers,
    customers: rawCustomers,
    packagingSpecs:
      Array.isArray(raw.packagingSpecs) && raw.packagingSpecs.length > 0
        ? raw.packagingSpecs
        : fallbackSeed.packagingSpecs,
    barcodeRules:
      Array.isArray(raw.barcodeRules) && raw.barcodeRules.length > 0
        ? raw.barcodeRules
        : fallbackSeed.barcodeRules,
    labelTemplates,
    boms,
    asns:
      Array.isArray(raw.asns) && raw.asns.length > 0 ? raw.asns : fallbackSeed.asns,
    materials,
    bins,
    reels,
    workOrders: Array.isArray(raw.workOrders) ? raw.workOrders : fallbackSeed.workOrders,
    waves: Array.isArray(raw.waves) ? raw.waves : fallbackSeed.waves,
    cycleCounts: Array.isArray(raw.cycleCounts) ? raw.cycleCounts : fallbackSeed.cycleCounts,
    scrapRecords: Array.isArray(raw.scrapRecords) ? raw.scrapRecords : fallbackSeed.scrapRecords,
    traceEvents: Array.isArray(raw.traceEvents) ? raw.traceEvents : fallbackSeed.traceEvents,
  };
}

function cloneState(state: WmsState): WmsState {
  return JSON.parse(JSON.stringify(state)) as WmsState;
}

export function generateId(prefix: string, now = new Date()): string {
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

export const MSD_FLOOR_LIFE_HOURS: Record<MsdLevel, number | null> = {
  'Level 1': null,
  'Level 2': 8760, // 1 year
  'Level 2a': 672, // 4 weeks
  'Level 3': 168,  // 7 days
  'Level 4': 72,   // 3 days
  'Level 5a': 24,  // 24 hours
};

export interface ParsedBarcode {
  raw: string;
  reelId?: string;
  mpn?: string;
  lotNumber?: string;
  dateCode?: string;
  qty?: number;
  matchedRuleId?: string;
  matchedRuleName?: string;
}

function tryRuleParse(trimmed: string, rule: BarcodeRule): ParsedBarcode | null {
  if (!rule.enabled || !trimmed.includes(rule.delimiter)) return null;
  const tokens = trimmed.split(rule.delimiter).map((t) => t.trim());

  if (rule.formatType === 'DELIMITED_ORDER') {
    if (tokens.some((t) => t.includes(':'))) return null;
    if (tokens.length < 3) return null;
    const getByIndex = (keyStr?: string) => {
      if (keyStr === undefined || keyStr.trim() === '') return undefined;
      const idx = Number(keyStr.trim());
      if (!Number.isInteger(idx) || idx < 0 || idx >= tokens.length) return undefined;
      return tokens[idx] || undefined;
    };
    const mpn = getByIndex(rule.fieldMap.mpnKey);
    const lotNumber = getByIndex(rule.fieldMap.lotKey);
    const dateCode = getByIndex(rule.fieldMap.dateCodeKey);
    const qtyRaw = getByIndex(rule.fieldMap.qtyKey);
    const reelId = getByIndex(rule.fieldMap.reelIdKey);
    const parsedQty = qtyRaw ? Number(qtyRaw) : undefined;
    const qty =
      parsedQty !== undefined && Number.isFinite(parsedQty) && parsedQty > 0
        ? parsedQty
        : undefined;

    if (mpn || lotNumber || dateCode) {
      return {
        raw: trimmed,
        reelId,
        mpn,
        lotNumber,
        dateCode,
        qty,
        matchedRuleId: rule.ruleId,
        matchedRuleName: rule.ruleName,
      };
    }
    return null;
  }

  // KEY_VALUE rule
  const kvMap = new Map<string, string>();
  for (const token of tokens) {
    const idx = token.indexOf(':');
    if (idx === -1) continue;
    const k = token.slice(0, idx).trim().toUpperCase();
    const v = token.slice(idx + 1).trim();
    if (k && v) kvMap.set(k, v);
  }
  if (kvMap.size === 0) return null;

  const pickAliases = (aliases?: string) => {
    if (!aliases) return undefined;
    for (const a of aliases.split(',')) {
      const val = kvMap.get(a.trim().toUpperCase());
      if (val) return val;
    }
    return undefined;
  };

  const reelId = pickAliases(rule.fieldMap.reelIdKey);
  const mpn = pickAliases(rule.fieldMap.mpnKey);
  const lotNumber = pickAliases(rule.fieldMap.lotKey);
  const dateCode = pickAliases(rule.fieldMap.dateCodeKey);
  const qtyRaw = pickAliases(rule.fieldMap.qtyKey);
  const parsedQty = qtyRaw ? Number(qtyRaw) : undefined;
  const qty =
    parsedQty !== undefined && Number.isFinite(parsedQty) && parsedQty > 0
      ? parsedQty
      : undefined;

  if (reelId || mpn || lotNumber) {
    return {
      raw: trimmed,
      reelId,
      mpn,
      lotNumber,
      dateCode,
      qty,
      matchedRuleId: rule.ruleId,
      matchedRuleName: rule.ruleName,
    };
  }
  return null;
}

/**
 * Parses either a plain UID (e.g. RL261015-001), a configured supplier barcode rule,
 * or an IPC-1782 composite QR string such as "UID:RL261117-001|P:STM32F407VET6|L:ST2645A|D:2645|Q:1000"
 */
export function parseBarcodeString(
  raw: string,
  rules?: BarcodeRule[],
  supplierHint?: string
): ParsedBarcode {
  const trimmed = raw.trim();
  if (!trimmed) return { raw: '' };

  if (rules && rules.length > 0) {
    const hint = (supplierHint ?? '').trim().toUpperCase();
    const ordered = rules
      .filter((r) => r.enabled)
      .slice()
      .sort((a, b) => {
        const aMatch =
          hint &&
          (a.supplierCode.toUpperCase() === hint ||
            a.supplierName.toUpperCase() === hint);
        const bMatch =
          hint &&
          (b.supplierCode.toUpperCase() === hint ||
            b.supplierName.toUpperCase() === hint);
        if (aMatch !== bMatch) return aMatch ? -1 : 1;
        if (a.supplierCode !== 'ALL' && b.supplierCode === 'ALL') return -1;
        if (a.supplierCode === 'ALL' && b.supplierCode !== 'ALL') return 1;
        return 0;
      });

    for (const rule of ordered) {
      const parsed = tryRuleParse(trimmed, rule);
      if (parsed) return parsed;
    }
  }

  if (trimmed.includes('|') || trimmed.includes(':')) {
    const tokens = trimmed.split(/[|;]/);
    const result: ParsedBarcode = { raw: trimmed };
    for (const token of tokens) {
      const idx = token.indexOf(':');
      if (idx === -1) continue;
      const key = token.slice(0, idx).trim().toUpperCase();
      const val = token.slice(idx + 1).trim();
      if (!val) continue;
      if (key === 'UID' || key === 'R' || key === 'REEL') result.reelId = val;
      if (key === 'P' || key === 'MPN' || key === 'PN') result.mpn = val;
      if (key === 'L' || key === 'LOT') result.lotNumber = val;
      if (key === 'D' || key === 'DC' || key === 'DATECODE') result.dateCode = val;
      if (key === 'Q' || key === 'QTY') {
        const parsedQty = Number(val);
        if (Number.isFinite(parsedQty) && parsedQty > 0) result.qty = parsedQty;
      }
    }
    if (result.reelId || result.mpn || result.lotNumber) {
      return result;
    }
  }

  return { raw: trimmed, reelId: trimmed };
}

export function calculateBomDemandQty(
  qtyPerBoard: number,
  attritionRate: number,
  targetQty: number
): number {
  return Math.ceil(qtyPerBoard * targetQty * (1 + attritionRate));
}

export interface KittingLineStatus {
  skuCode: string;
  mpn: string;
  name: string;
  requiredQty: number;
  issuedQty: number;
  netNeededQty: number;
  availableStockQty: number;
  shortageQty: number;
  isReady: boolean;
}

export function computeWorkOrderKitting(
  wo: WorkOrder,
  reels: ReelItem[],
  materials: MaterialSku[]
): { lines: KittingLineStatus[]; readinessPercent: number; isFullyKitted: boolean } {
  const stockBySku = new Map<string, number>();
  for (const r of reels) {
    if (
      r.status === 'IN_STOCK' &&
      r.msdState !== 'BAKING_REQUIRED' &&
      r.qty > 0 &&
      isReelEligibleForCustomer(r, wo.customerCode)
    ) {
      stockBySku.set(r.skuCode, (stockBySku.get(r.skuCode) ?? 0) + r.qty);
    }
  }

  const requiredItems = wo.bom.filter((b) => b.itemRole !== 'SUBSTITUTE');
  const lines: KittingLineStatus[] = requiredItems.map((b) => {
    const mat = materials.find((m) => m.skuCode === b.skuCode);
    const requiredQty = calculateBomDemandQty(b.qtyPerBoard, b.attritionRate, wo.targetQty);
    const issuedQty = wo.issuedBySku[b.skuCode] ?? 0;
    const netNeededQty = Math.max(0, requiredQty - issuedQty);
    const availableStockQty = stockBySku.get(b.skuCode) ?? 0;
    const shortageQty = Math.max(0, netNeededQty - availableStockQty);
    return {
      skuCode: b.skuCode,
      mpn: mat?.mpn ?? b.skuCode,
      name: mat?.name ?? b.skuCode,
      requiredQty,
      issuedQty,
      netNeededQty,
      availableStockQty,
      shortageQty,
      isReady: shortageQty === 0,
    };
  });

  const readyCount = lines.filter((l) => l.isReady).length;
  const readinessPercent =
    lines.length === 0 ? 100 : Math.round((readyCount / lines.length) * 100);
  return {
    lines,
    readinessPercent,
    isFullyKitted: lines.every((l) => l.isReady),
  };
}

export interface InboundInput {
  materialKey?: string;
  skuCode: string;
  lotNumber: string;
  dateCode: string;
  supplier: string;
  qty: number;
  binCode: string;
  receiptDocNo?: string;
  asnNo?: string;
  asnLineId?: string;
  reelId?: string;
  operator: string;
  reason?: string;
}

export function applyInbound(
  state: WmsState,
  input: InboundInput,
  now = new Date()
): { state: WmsState; reel: ReelItem; event: TraceEvent } {
  const material =
    (input.materialKey
      ? state.materials.find((m) => m.materialKey === input.materialKey)
      : undefined) ?? state.materials.find((m) => m.skuCode === input.skuCode);
  if (!material) {
    throw new Error(`未找到物料编码: ${input.skuCode}`);
  }
  if (!input.lotNumber.trim()) {
    throw new Error('供应商批次号(Lot)不能为空');
  }
  if (!/^\d{4}$/.test(input.dateCode.trim())) {
    throw new Error('周期码(DateCode)必须为4位数字，例如 2645');
  }
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    throw new Error('入库数量必须大于 0');
  }
  const binExists = state.bins.some((b) => b.binCode === input.binCode);
  if (!binExists) {
    throw new Error(`库位不存在: ${input.binCode}`);
  }

  const next = cloneState(state);
  const iso = now.toISOString();
  const reelId = input.reelId?.trim() || generateId('RL', now);
  if (next.reels.some((r) => r.reelId === reelId)) {
    throw new Error(`料盘条码已存在: ${reelId}`);
  }

  const asnNo = input.asnNo?.trim() || undefined;
  let linkedSupplier = input.supplier.trim() || material.supplierName || '现货采购';
  if (asnNo) {
    const asn = next.asns.find((a) => a.asnNo === asnNo);
    if (!asn) {
      throw new Error(`ASN收料单不存在: ${asnNo}`);
    }
    if (asn.status === 'CANCELLED') {
      throw new Error(`ASN收料单 ${asnNo} 已作废，无法收料`);
    }
    const line =
      (input.asnLineId
        ? asn.lines.find((l) => l.lineId === input.asnLineId)
        : undefined) ?? asn.lines.find((l) => l.skuCode === material.skuCode);
    if (!line) {
      throw new Error(`ASN单 ${asnNo} 中未包含物料 ${material.skuCode}`);
    }
    line.receivedQty += input.qty;
    linkedSupplier = input.supplier.trim() || asn.supplierName;
    const allComplete = asn.lines.every((l) => l.receivedQty >= l.expectedQty);
    const anyReceived = asn.lines.some((l) => l.receivedQty > 0);
    asn.status = allComplete ? 'COMPLETED' : anyReceived ? 'PARTIAL' : 'PENDING';
  }

  const ownershipType = material.ownershipType ?? 'SELF_PURCHASED';
  const ownerCode = material.ownerCode ?? 'INTERNAL';
  const ownerName = material.ownerName ?? '本厂自购';
  const customerCode =
    ownershipType === 'CUSTOMER_CONSIGNED'
      ? ownerCode
      : (material.customerCode ?? '').trim().toUpperCase();
  const customerName = customerCode
    ? material.customerName ??
      next.customers.find((c) => c.customerCode === customerCode)?.customerName ??
      customerCode
    : '通用共享 (不限客户)';
  const materialKey =
    material.materialKey ??
    buildMaterialKey(material.skuCode, ownershipType, ownerCode, customerCode);

  const receiptDocNo = input.receiptDocNo?.trim() || asnNo || generateId('RCV', now);
  const reel: ReelItem = {
    reelId,
    materialKey,
    skuCode: material.skuCode,
    mpn: material.mpn,
    lotNumber: input.lotNumber.trim(),
    dateCode: input.dateCode.trim(),
    supplier: linkedSupplier,
    ownershipType,
    ownerCode,
    ownerName,
    customerCode,
    customerName,
    packagingCode: material.packagingCode,
    mpq: material.mpq,
    receiptDocNo,
    asnNo,
    initialQty: input.qty,
    qty: input.qty,
    issuedQty: 0,
    binCode: input.binCode,
    msdLevel: material.msdLevel,
    msdState: 'SEALED',
    status: 'IN_STOCK',
    receivedAt: iso,
    updatedAt: iso,
  };

  const event: TraceEvent = {
    eventId: generateId('EVT', now),
    timestamp: iso,
    action: 'INBOUND',
    reelId: reel.reelId,
    skuCode: reel.skuCode,
    mpn: reel.mpn,
    lotNumber: reel.lotNumber,
    dateCode: reel.dateCode,
    qtyDelta: input.qty,
    balanceAfter: input.qty,
    toBin: input.binCode,
    docNo: receiptDocNo,
    reason:
      input.reason?.trim() ||
      (asnNo ? `按ASN (${asnNo}) 到货IQC合格入库` : '无ERP独立收料IQC合格入库'),
    operator: input.operator.trim() || '仓管员',
  };

  next.reels.unshift(reel);
  next.traceEvents.unshift(event);
  return { state: next, reel, event };
}

export interface DemandItem {
  skuCode: string;
  mpn: string;
  requiredQty: number;
  customerCode?: string;
  customerName?: string;
}

export function consolidateWaveDemand(
  workOrders: WorkOrder[],
  materials: MaterialSku[]
): DemandItem[] {
  const map = new Map<
    string,
    { skuCode: string; customerCode?: string; customerName?: string; requiredQty: number }
  >();
  for (const wo of workOrders) {
    const woCus = (wo.customerCode ?? '').trim().toUpperCase();
    for (const item of wo.bom) {
      if (item.itemRole === 'SUBSTITUTE') continue;
      const totalRequired = calculateBomDemandQty(
        item.qtyPerBoard,
        item.attritionRate,
        wo.targetQty
      );
      const alreadyIssued = wo.issuedBySku[item.skuCode] ?? 0;
      const net = Math.max(0, totalRequired - alreadyIssued);
      if (net > 0) {
        const bucketKey = `${item.skuCode}::${woCus}`;
        const prev = map.get(bucketKey);
        map.set(bucketKey, {
          skuCode: item.skuCode,
          customerCode: woCus || undefined,
          customerName: wo.customerName,
          requiredQty: (prev?.requiredQty ?? 0) + net,
        });
      }
    }
  }

  const demands: DemandItem[] = [];
  for (const entry of map.values()) {
    const mat = materials.find((m) => m.skuCode === entry.skuCode);
    demands.push({
      skuCode: entry.skuCode,
      mpn: mat?.mpn ?? entry.skuCode,
      customerCode: entry.customerCode,
      customerName: entry.customerName,
      requiredQty: entry.requiredQty,
    });
  }
  return demands;
}

export function allocateReelsFIFO(
  reels: ReelItem[],
  demands: DemandItem[]
): { allocations: WaveAllocation[]; shortages: { skuCode: string; mpn: string; shortageQty: number }[] } {
  const allocations: WaveAllocation[] = [];
  const shortages: { skuCode: string; mpn: string; shortageQty: number }[] = [];

  // Strict FIFO by DateCode asc, then receivedAt asc; block reels locked for MSD baking
  const eligible = reels
    .filter(
      (r) =>
        r.status === 'IN_STOCK' &&
        r.msdState !== 'BAKING_REQUIRED' &&
        r.qty > 0
    )
    .slice()
    .sort((a, b) => {
      if (a.dateCode !== b.dateCode) {
        return a.dateCode.localeCompare(b.dateCode);
      }
      return a.receivedAt.localeCompare(b.receivedAt);
    });

  const remainingByReel = new Map<string, number>();
  for (const r of eligible) {
    remainingByReel.set(r.reelId, r.qty);
  }

  let idx = 1;
  for (const demand of demands) {
    let need = demand.requiredQty;
    const demandCus = (demand.customerCode ?? '').trim().toUpperCase();

    // Filter to customer-eligible reels, preferring customer-dedicated stock before shared COMMON stock
    const candidateReels = eligible
      .filter(
        (reel) =>
          reel.skuCode === demand.skuCode &&
          isReelEligibleForCustomer(reel, demand.customerCode)
      )
      .sort((a, b) => {
        const aDed = demandCus && getReelCustomerScope(a) === demandCus ? 0 : 1;
        const bDed = demandCus && getReelCustomerScope(b) === demandCus ? 0 : 1;
        if (aDed !== bDed) return aDed - bDed;
        if (a.dateCode !== b.dateCode) return a.dateCode.localeCompare(b.dateCode);
        return a.receivedAt.localeCompare(b.receivedAt);
      });

    for (const reel of candidateReels) {
      if (need <= 0) break;
      const avail = remainingByReel.get(reel.reelId) ?? 0;
      if (avail <= 0) continue;

      const pickQty = Math.min(avail, need);
      remainingByReel.set(reel.reelId, avail - pickQty);
      need -= pickQty;

      allocations.push({
        id: `WA-${idx++}`,
        skuCode: demand.skuCode,
        mpn: demand.mpn,
        customerCode: demand.customerCode,
        customerName: demand.customerName,
        reelId: reel.reelId,
        binCode: reel.binCode,
        dateCode: reel.dateCode,
        lotNumber: reel.lotNumber,
        requiredQty: pickQty,
        pickedQty: 0,
        status: 'PENDING',
      });
    }

    if (need > 0) {
      shortages.push({
        skuCode: demand.skuCode,
        mpn: demand.mpn,
        shortageQty: need,
      });
    }
  }

  return { allocations, shortages };
}

export function createWaveOrder(
  state: WmsState,
  input: { name: string; workOrderIds: string[]; operator: string },
  now = new Date()
): { state: WmsState; wave: WaveOrder; shortages: { skuCode: string; mpn: string; shortageQty: number }[] } {
  if (input.workOrderIds.length === 0) {
    throw new Error('请至少选择一个工单生成波次');
  }
  const selectedWos = state.workOrders.filter((w) =>
    input.workOrderIds.includes(w.workOrderId)
  );
  if (selectedWos.length !== input.workOrderIds.length) {
    throw new Error('存在无效的工单编号');
  }

  const demands = consolidateWaveDemand(selectedWos, state.materials);
  if (demands.length === 0) {
    throw new Error('所选工单BOM需求已全部发料完成，无需生成波次');
  }

  const { allocations, shortages } = allocateReelsFIFO(state.reels, demands);
  if (allocations.length === 0) {
    throw new Error('当前库存无可分配的在库料盘，请先入库或解除MSD锁定');
  }

  const next = cloneState(state);
  const iso = now.toISOString();
  const waveId = generateId('WAVE', now);

  const wave: WaveOrder = {
    waveId,
    name: input.name.trim() || `波次发料 ${waveId}`,
    workOrderIds: [...input.workOrderIds],
    status: 'OPEN',
    allocations,
    createdAt: iso,
  };

  for (const wo of next.workOrders) {
    if (input.workOrderIds.includes(wo.workOrderId)) {
      wo.waveId = waveId;
      if (wo.status === 'PLANNED') {
        wo.status = 'WAVED';
      }
    }
  }

  const allocatedReelIds = new Set(allocations.map((a) => a.reelId));
  for (const reel of next.reels) {
    if (allocatedReelIds.has(reel.reelId)) {
      reel.status = 'ALLOCATED';
      reel.updatedAt = iso;
      next.traceEvents.unshift({
        eventId: generateId('EVT', now),
        timestamp: iso,
        action: 'WAVE_ALLOCATE',
        reelId: reel.reelId,
        skuCode: reel.skuCode,
        mpn: reel.mpn,
        lotNumber: reel.lotNumber,
        dateCode: reel.dateCode,
        qtyDelta: 0,
        balanceAfter: reel.qty,
        fromBin: reel.binCode,
        waveId,
        workOrderId: input.workOrderIds.join(', '),
        docNo: waveId,
        reason: `波次锁定(FIFO优先周期 ${reel.dateCode})`,
        operator: input.operator.trim() || '仓管员',
      });
    }
  }

  next.waves.unshift(wave);
  return { state: next, wave, shortages };
}

export function issueWaveAllocation(
  state: WmsState,
  input: { waveId: string; reelId: string; operator: string },
  now = new Date()
): { state: WmsState; wave: WaveOrder; event: TraceEvent } {
  const next = cloneState(state);
  const iso = now.toISOString();
  const parsed = parseBarcodeString(input.reelId);
  const targetReelId = parsed.reelId ?? input.reelId.trim();

  const wave = next.waves.find((w) => w.waveId === input.waveId);
  if (!wave) {
    throw new Error(`波次单不存在: ${input.waveId}`);
  }

  const alloc = wave.allocations.find(
    (a) => a.reelId === targetReelId && a.status === 'PENDING'
  );
  if (!alloc) {
    // Check if they scanned a reel of the same SKU with newer DateCode (FIFO violation guard!) or wrong customer
    const scannedReel = next.reels.find((r) => r.reelId === targetReelId);
    if (scannedReel) {
      const scannedScope = getReelCustomerScope(scannedReel);
      const pendingSameSku = wave.allocations.find(
        (a) => a.skuCode === scannedReel.skuCode && a.status === 'PENDING'
      );
      if (pendingSameSku) {
        if (!isReelEligibleForCustomer(scannedReel, pendingSameSku.customerCode)) {
          throw new Error(
            `客户业务归属防错拦截: 料盘 ${scannedReel.reelId} 属于「${scannedReel.customerName || scannedScope}」专备物料，禁止发往客户「${pendingSameSku.customerName || '其他客户'}」的波次`
          );
        }
        throw new Error(
          `FIFO防错拦截: 物料 ${scannedReel.mpn} 存在更早周期(${pendingSameSku.dateCode})的指定料盘 ${pendingSameSku.reelId} (库位 ${pendingSameSku.binCode})，禁止跳过先进先出`
        );
      }
    }
    throw new Error(`波次 ${input.waveId} 中未找到待拣货料盘: ${targetReelId}`);
  }

  const reel = next.reels.find((r) => r.reelId === alloc.reelId);
  if (!reel) {
    throw new Error(`料盘不存在: ${alloc.reelId}`);
  }
  if (!isReelEligibleForCustomer(reel, alloc.customerCode)) {
    throw new Error(
      `客户发料拦截: 料盘 ${reel.reelId} 专属客户与工单客户不一致`
    );
  }
  if (reel.msdState === 'BAKING_REQUIRED') {
    throw new Error(`MSD防潮拦截: 料盘 ${reel.reelId} 暴露超时需烘烤，禁止发料`);
  }
  if (reel.qty < alloc.requiredQty) {
    throw new Error(`料盘 ${reel.reelId} 当前余量不足 (${reel.qty} < ${alloc.requiredQty})`);
  }

  const fromBin = reel.binCode;
  reel.qty -= alloc.requiredQty;
  reel.issuedQty += alloc.requiredQty;
  reel.workOrderId = wave.workOrderIds[0];
  reel.updatedAt = iso;
  if (reel.msdLevel !== 'Level 1' && reel.msdState === 'SEALED') {
    reel.msdState = 'EXPOSED';
    reel.msdOpenAt = iso;
  }

  if (reel.qty === 0) {
    reel.status = 'DEPLETED';
    reel.binCode = 'LINE-SMT-01';
  } else {
    reel.status = 'ISSUED_TO_LINE';
    reel.binCode = 'LINE-SMT-01';
  }

  alloc.pickedQty = alloc.requiredQty;
  alloc.status = 'PICKED';

  let remainingToAssign = alloc.requiredQty;
  for (const woId of wave.workOrderIds) {
    if (remainingToAssign <= 0) break;
    const wo = next.workOrders.find((w) => w.workOrderId === woId);
    if (!wo) continue;
    const bomItem = wo.bom.find((b) => b.skuCode === alloc.skuCode);
    if (!bomItem) continue;
    const totalReq = calculateBomDemandQty(
      bomItem.qtyPerBoard,
      bomItem.attritionRate,
      wo.targetQty
    );
    const prevIssued = wo.issuedBySku[alloc.skuCode] ?? 0;
    const need = Math.max(0, totalReq - prevIssued);
    const assign = Math.min(need, remainingToAssign);
    if (assign > 0) {
      wo.issuedBySku[alloc.skuCode] = prevIssued + assign;
      remainingToAssign -= assign;
    }
    wo.status = 'ISSUING';
  }
  if (remainingToAssign > 0 && wave.workOrderIds[0]) {
    const firstWo = next.workOrders.find((w) => w.workOrderId === wave.workOrderIds[0]);
    if (firstWo) {
      firstWo.issuedBySku[alloc.skuCode] =
        (firstWo.issuedBySku[alloc.skuCode] ?? 0) + remainingToAssign;
    }
  }

  const allPicked = wave.allocations.every((a) => a.status === 'PICKED');
  wave.status = allPicked ? 'COMPLETED' : 'PICKING';
  if (allPicked) {
    wave.completedAt = iso;
    for (const woId of wave.workOrderIds) {
      const wo = next.workOrders.find((w) => w.workOrderId === woId);
      if (wo) {
        wo.status = 'IN_PRODUCTION';
      }
    }
  }

  const targetLine =
    next.workOrders.find((w) => w.workOrderId === wave.workOrderIds[0])?.lineName ??
    'SMT-Line-01';

  const event: TraceEvent = {
    eventId: generateId('EVT', now),
    timestamp: iso,
    action: 'WAVE_ISSUE',
    reelId: reel.reelId,
    skuCode: reel.skuCode,
    mpn: reel.mpn,
    lotNumber: reel.lotNumber,
    dateCode: reel.dateCode,
    qtyDelta: -alloc.requiredQty,
    balanceAfter: reel.qty,
    fromBin,
    toBin: 'LINE-SMT-01',
    waveId: wave.waveId,
    workOrderId: wave.workOrderIds.join(', '),
    lineOrStation: targetLine,
    docNo: wave.waveId,
    reason: `波次扫码发料出库 (需求 ${alloc.requiredQty})`,
    operator: input.operator.trim() || '发料员',
  };

  next.traceEvents.unshift(event);
  return { state: next, wave, event };
}

export function applyGeneralOutbound(
  state: WmsState,
  input: {
    reelId: string;
    qty: number;
    targetDept: string;
    reason: string;
    operator: string;
  },
  now = new Date()
): { state: WmsState; reel: ReelItem; event: TraceEvent } {
  const next = cloneState(state);
  const iso = now.toISOString();
  const targetReelId = parseBarcodeString(input.reelId).reelId ?? input.reelId.trim();
  const reel = next.reels.find((r) => r.reelId === targetReelId);
  if (!reel) {
    throw new Error(`未找到料盘条码: ${targetReelId}`);
  }
  if (reel.status === 'SCRAPPED') {
    throw new Error(`料盘 ${reel.reelId} 已报废，无法出库`);
  }
  if (reel.msdState === 'BAKING_REQUIRED') {
    throw new Error(`MSD防潮拦截: 料盘 ${reel.reelId} 暴露超时需烘烤，无法出库`);
  }
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    throw new Error('出库数量必须大于 0');
  }
  if (input.qty > reel.qty) {
    throw new Error(`料盘当前可用余量不足 (${reel.qty} < ${input.qty})`);
  }

  const fromBin = reel.binCode;
  reel.qty -= input.qty;
  reel.issuedQty += input.qty;
  reel.updatedAt = iso;
  if (reel.qty === 0) {
    reel.status = 'DEPLETED';
  }

  const docNo = generateId('OUT', now);
  const event: TraceEvent = {
    eventId: generateId('EVT', now),
    timestamp: iso,
    action: 'GENERAL_OUTBOUND',
    reelId: reel.reelId,
    skuCode: reel.skuCode,
    mpn: reel.mpn,
    lotNumber: reel.lotNumber,
    dateCode: reel.dateCode,
    qtyDelta: -input.qty,
    balanceAfter: reel.qty,
    fromBin,
    toBin: input.targetDept.trim() || '研发试产/外发',
    lineOrStation: input.targetDept.trim() || '研发工程部',
    docNo,
    reason: input.reason.trim() || '非工单领料出库',
    operator: input.operator.trim() || '仓管员',
  };

  next.traceEvents.unshift(event);
  return { state: next, reel, event };
}

export function applyReplenishment(
  state: WmsState,
  input: {
    workOrderId: string;
    reelId: string;
    qty: number;
    reason: string;
    station: string;
    operator: string;
  },
  now = new Date()
): { state: WmsState; reel: ReelItem; event: TraceEvent } {
  const next = cloneState(state);
  const iso = now.toISOString();

  const wo = next.workOrders.find((w) => w.workOrderId === input.workOrderId.trim());
  if (!wo) {
    throw new Error(`工单不存在: ${input.workOrderId}`);
  }
  const targetReelId = parseBarcodeString(input.reelId).reelId ?? input.reelId.trim();
  const reel = next.reels.find((r) => r.reelId === targetReelId);
  if (!reel) {
    throw new Error(`未找到料盘条码: ${targetReelId}`);
  }
  if (reel.status === 'SCRAPPED' || reel.status === 'DEPLETED') {
    throw new Error(`料盘 ${reel.reelId} 状态为 ${reel.status}，无法用于补料`);
  }
  if (!isReelEligibleForCustomer(reel, wo.customerCode)) {
    throw new Error(
      `客户归属防错拦截: 料盘 ${reel.reelId} 为「${reel.customerName || reel.ownerName}」专用物料，不能补料到客户「${wo.customerName || '内部自研'}」的工单 ${wo.workOrderId}`
    );
  }
  if (reel.msdState === 'BAKING_REQUIRED') {
    throw new Error(`MSD防潮拦截: 料盘 ${reel.reelId} 需烘烤复位后方可用于产线补料`);
  }
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    throw new Error('补料数量必须大于 0');
  }
  if (input.qty > reel.qty) {
    throw new Error(`料盘余量不足 (${reel.qty} < ${input.qty})`);
  }

  const fromBin = reel.binCode;
  reel.qty -= input.qty;
  reel.issuedQty += input.qty;
  reel.workOrderId = wo.workOrderId;
  reel.updatedAt = iso;
  if (reel.msdLevel !== 'Level 1' && reel.msdState === 'SEALED') {
    reel.msdState = 'EXPOSED';
    reel.msdOpenAt = iso;
  }
  if (reel.qty === 0) {
    reel.status = 'DEPLETED';
    reel.binCode = 'LINE-SMT-01';
  } else {
    reel.status = 'ISSUED_TO_LINE';
    reel.binCode = 'LINE-SMT-01';
  }

  wo.replenishedBySku[reel.skuCode] =
    (wo.replenishedBySku[reel.skuCode] ?? 0) + input.qty;

  const docNo = generateId('REP', now);
  const event: TraceEvent = {
    eventId: generateId('EVT', now),
    timestamp: iso,
    action: 'REPLENISH',
    reelId: reel.reelId,
    skuCode: reel.skuCode,
    mpn: reel.mpn,
    lotNumber: reel.lotNumber,
    dateCode: reel.dateCode,
    qtyDelta: -input.qty,
    balanceAfter: reel.qty,
    fromBin,
    toBin: 'LINE-SMT-01',
    workOrderId: wo.workOrderId,
    lineOrStation: input.station.trim() || wo.lineName,
    docNo,
    reason: input.reason.trim() || 'SMT抛料损耗补料',
    operator: input.operator.trim() || '产线物料员',
  };

  next.traceEvents.unshift(event);
  return { state: next, reel, event };
}

export function applyProductionReturn(
  state: WmsState,
  input: {
    workOrderId: string;
    reelId: string;
    returnQty: number;
    toBin: string;
    reason: string;
    operator: string;
    splitChildReel?: boolean;
  },
  now = new Date()
): { state: WmsState; reel: ReelItem; event: TraceEvent } {
  const next = cloneState(state);
  const iso = now.toISOString();

  const wo = next.workOrders.find((w) => w.workOrderId === input.workOrderId.trim());
  if (!wo) {
    throw new Error(`工单不存在: ${input.workOrderId}`);
  }
  const targetReelId = parseBarcodeString(input.reelId).reelId ?? input.reelId.trim();
  const parentReel = next.reels.find((r) => r.reelId === targetReelId);
  if (!parentReel) {
    throw new Error(`未找到料盘条码: ${targetReelId}`);
  }
  if (parentReel.status === 'SCRAPPED') {
    throw new Error(`料盘 ${parentReel.reelId} 已报废，不能退料入库`);
  }
  if (!Number.isFinite(input.returnQty) || input.returnQty <= 0) {
    throw new Error('退料数量必须大于 0');
  }
  if (!next.bins.some((b) => b.binCode === input.toBin)) {
    throw new Error(`目标退料库位不存在: ${input.toBin}`);
  }
  if (parentReel.qty + input.returnQty > parentReel.initialQty) {
    throw new Error(
      `退料后数量 (${parentReel.qty + input.returnQty}) 不能超过料盘初始包装数量 (${parentReel.initialQty})`
    );
  }

  const fromBin = parentReel.binCode;
  const docNo = generateId('RET', now);
  let returnedReel: ReelItem;

  if (input.splitChildReel) {
    // Partial reel splitting: create a new child UID reel for the returned remainder
    parentReel.issuedQty = Math.max(0, parentReel.issuedQty - input.returnQty);
    parentReel.updatedAt = iso;
    const childId = `${parentReel.reelId}-S${Math.floor(10 + Math.random() * 89)}`;
    returnedReel = {
      reelId: childId,
      parentReelId: parentReel.reelId,
      materialKey: parentReel.materialKey,
      skuCode: parentReel.skuCode,
      mpn: parentReel.mpn,
      lotNumber: parentReel.lotNumber,
      dateCode: parentReel.dateCode,
      supplier: parentReel.supplier,
      ownershipType: parentReel.ownershipType,
      ownerCode: parentReel.ownerCode,
      ownerName: parentReel.ownerName,
      customerCode: parentReel.customerCode,
      customerName: parentReel.customerName,
      packagingCode: parentReel.packagingCode,
      mpq: parentReel.mpq,
      receiptDocNo: docNo,
      initialQty: input.returnQty,
      qty: input.returnQty,
      issuedQty: 0,
      binCode: input.toBin,
      msdLevel: parentReel.msdLevel,
      msdState: parentReel.msdLevel === 'Level 1' ? 'SEALED' : parentReel.msdState,
      msdOpenAt: parentReel.msdOpenAt,
      status: 'IN_STOCK',
      receivedAt: parentReel.receivedAt,
      updatedAt: iso,
    };
    next.reels.unshift(returnedReel);
  } else {
    parentReel.qty += input.returnQty;
    parentReel.issuedQty = Math.max(0, parentReel.issuedQty - input.returnQty);
    parentReel.binCode = input.toBin;
    parentReel.status = 'IN_STOCK';
    parentReel.workOrderId = undefined;
    parentReel.updatedAt = iso;
    returnedReel = parentReel;
  }

  wo.returnedBySku[returnedReel.skuCode] =
    (wo.returnedBySku[returnedReel.skuCode] ?? 0) + input.returnQty;

  const event: TraceEvent = {
    eventId: generateId('EVT', now),
    timestamp: iso,
    action: 'RETURN',
    reelId: returnedReel.reelId,
    skuCode: returnedReel.skuCode,
    mpn: returnedReel.mpn,
    lotNumber: returnedReel.lotNumber,
    dateCode: returnedReel.dateCode,
    qtyDelta: input.returnQty,
    balanceAfter: returnedReel.qty,
    fromBin,
    toBin: input.toBin,
    workOrderId: wo.workOrderId,
    lineOrStation: wo.lineName,
    docNo,
    reason: input.splitChildReel
      ? `${input.reason.trim() || '散料分拆退库'} (母盘: ${parentReel.reelId})`
      : input.reason.trim() || '工单完工/换线余料点数退库',
    operator: input.operator.trim() || '产线物料员',
  };

  next.traceEvents.unshift(event);
  return { state: next, reel: returnedReel, event };
}

export function bakeMsdReel(
  state: WmsState,
  input: { reelId: string; operator: string; ovenNotes?: string },
  now = new Date()
): { state: WmsState; reel: ReelItem; event: TraceEvent } {
  const next = cloneState(state);
  const iso = now.toISOString();
  const reel = next.reels.find((r) => r.reelId === input.reelId.trim());
  if (!reel) {
    throw new Error(`未找到料盘条码: ${input.reelId}`);
  }
  reel.msdState = 'SEALED';
  reel.msdOpenAt = undefined;
  reel.updatedAt = iso;

  const docNo = generateId('BAKE', now);
  const event: TraceEvent = {
    eventId: generateId('EVT', now),
    timestamp: iso,
    action: 'MSD_BAKE',
    reelId: reel.reelId,
    skuCode: reel.skuCode,
    mpn: reel.mpn,
    lotNumber: reel.lotNumber,
    dateCode: reel.dateCode,
    qtyDelta: 0,
    balanceAfter: reel.qty,
    fromBin: reel.binCode,
    toBin: reel.binCode,
    docNo,
    reason: input.ovenNotes?.trim() || '125℃恒温烘烤除湿复位并重新真空密封',
    operator: input.operator.trim() || 'IQC/仓管员',
  };

  next.traceEvents.unshift(event);
  return { state: next, reel, event };
}

export function applyScrap(
  state: WmsState,
  input: {
    reelId: string;
    qty: number;
    reason: string;
    disposition: string;
    workOrderId?: string;
    operator: string;
  },
  now = new Date()
): { state: WmsState; scrap: ScrapRecord; event: TraceEvent } {
  const next = cloneState(state);
  const iso = now.toISOString();
  const targetReelId = parseBarcodeString(input.reelId).reelId ?? input.reelId.trim();

  const reel = next.reels.find((r) => r.reelId === targetReelId);
  if (!reel) {
    throw new Error(`未找到料盘条码: ${targetReelId}`);
  }
  if (reel.status === 'SCRAPPED') {
    throw new Error(`料盘 ${reel.reelId} 已经处于报废状态`);
  }
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    throw new Error('报废数量必须大于 0');
  }
  if (input.qty > reel.qty) {
    throw new Error(`报废数量 (${input.qty}) 不能大于当前余量 (${reel.qty})`);
  }

  const fromBin = reel.binCode;
  reel.qty -= input.qty;
  reel.updatedAt = iso;
  if (reel.qty === 0) {
    reel.status = 'SCRAPPED';
    reel.binCode = 'MRB-01-01';
  }

  const scrapId = generateId('SCR', now);
  const scrap: ScrapRecord = {
    scrapId,
    timestamp: iso,
    reelId: reel.reelId,
    skuCode: reel.skuCode,
    mpn: reel.mpn,
    lotNumber: reel.lotNumber,
    qty: input.qty,
    reason: input.reason.trim() || 'MSD受潮失效/SMT抛料损毁',
    disposition: input.disposition.trim() || 'MRB评审销毁',
    workOrderId: input.workOrderId?.trim() || reel.workOrderId,
    operator: input.operator.trim() || 'QE工程师',
  };

  const event: TraceEvent = {
    eventId: generateId('EVT', now),
    timestamp: iso,
    action: 'SCRAP',
    reelId: reel.reelId,
    skuCode: reel.skuCode,
    mpn: reel.mpn,
    lotNumber: reel.lotNumber,
    dateCode: reel.dateCode,
    qtyDelta: -input.qty,
    balanceAfter: reel.qty,
    fromBin,
    toBin: 'MRB-01-01',
    workOrderId: scrap.workOrderId,
    docNo: scrapId,
    reason: `${scrap.reason} (${scrap.disposition})`,
    operator: scrap.operator,
  };

  next.scrapRecords.unshift(scrap);
  next.traceEvents.unshift(event);
  return { state: next, scrap, event };
}

export function createCycleCountTask(
  state: WmsState,
  input: { title: string; zoneFilter: string },
  now = new Date()
): { state: WmsState; task: CycleCountTask } {
  const next = cloneState(state);
  const iso = now.toISOString();
  const binSet = new Set(
    input.zoneFilter === '全部库区'
      ? next.bins.map((b) => b.binCode)
      : next.bins.filter((b) => b.zone === input.zoneFilter).map((b) => b.binCode)
  );

  const lines = next.reels
    .filter((r) => r.status !== 'SCRAPPED' && r.status !== 'DEPLETED' && binSet.has(r.binCode))
    .map((r) => ({
      reelId: r.reelId,
      skuCode: r.skuCode,
      mpn: r.mpn,
      binCode: r.binCode,
      bookQty: r.qty,
      countedQty: null,
      variance: 0,
      adjusted: false,
    }));

  if (lines.length === 0) {
    throw new Error('所选库区暂无可盘点的在库料盘');
  }

  const task: CycleCountTask = {
    countId: generateId('CC', now),
    title: input.title.trim() || `${input.zoneFilter} 盘点单`,
    zoneFilter: input.zoneFilter,
    status: 'IN_PROGRESS',
    lines,
    createdAt: iso,
  };

  next.cycleCounts.unshift(task);
  return { state: next, task };
}

export function applyCycleCountReconcile(
  state: WmsState,
  input: {
    countId: string;
    counts: Record<string, number>;
    operator: string;
  },
  now = new Date()
): { state: WmsState; task: CycleCountTask } {
  const next = cloneState(state);
  const iso = now.toISOString();
  const task = next.cycleCounts.find((c) => c.countId === input.countId);
  if (!task) {
    throw new Error(`盘点单不存在: ${input.countId}`);
  }
  if (task.status === 'COMPLETED') {
    throw new Error(`盘点单 ${input.countId} 已完成调账`);
  }

  for (const line of task.lines) {
    const counted = input.counts[line.reelId];
    if (counted === undefined || counted === null || !Number.isFinite(counted) || counted < 0) {
      throw new Error(`料盘 ${line.reelId} 实盘数量无效`);
    }
    line.countedQty = counted;
    line.variance = counted - line.bookQty;

    if (line.variance !== 0) {
      const reel = next.reels.find((r) => r.reelId === line.reelId);
      if (reel) {
        reel.qty = counted;
        reel.updatedAt = iso;
        if (counted === 0) {
          reel.status = 'DEPLETED';
        }
        next.traceEvents.unshift({
          eventId: generateId('EVT', now),
          timestamp: iso,
          action: 'CYCLE_COUNT',
          reelId: reel.reelId,
          skuCode: reel.skuCode,
          mpn: reel.mpn,
          lotNumber: reel.lotNumber,
          dateCode: reel.dateCode,
          qtyDelta: line.variance,
          balanceAfter: counted,
          fromBin: reel.binCode,
          toBin: reel.binCode,
          docNo: task.countId,
          reason: `盘点差异调账 (账面 ${line.bookQty} -> 实盘 ${counted})`,
          operator: input.operator.trim() || '盘点员',
        });
      }
      line.adjusted = true;
    } else {
      line.adjusted = true;
    }
  }

  task.status = 'COMPLETED';
  task.completedAt = iso;
  return { state: next, task };
}

export function addMaterialSku(
  state: WmsState,
  input: MaterialSku
): { state: WmsState; material: MaterialSku } {
  const mpn = input.mpn.trim();
  const skuCode = (input.skuCode?.trim() || mpn).toUpperCase();
  const name = input.name.trim();
  if (!skuCode || !mpn || !name) {
    throw new Error('料号 SKU、原厂型号 MPN 和物料描述不能为空');
  }

  const ownershipType: MaterialOwnershipType = input.ownershipType ?? 'SELF_PURCHASED';
  let ownerCode =
    ownershipType === 'SELF_PURCHASED'
      ? 'INTERNAL'
      : (input.ownerCode ?? '').trim().toUpperCase();

  if (ownershipType !== 'SELF_PURCHASED' && !ownerCode) {
    throw new Error(
      ownershipType === 'CUSTOMER_CONSIGNED'
        ? '客户客供料必须指定归属客户编码'
        : 'VMI寄售料必须指定归属供应商编码'
    );
  }

  let ownerName = input.ownerName?.trim() || '本厂自购';
  if (ownershipType === 'CUSTOMER_CONSIGNED') {
    const cus = state.customers.find((c) => c.customerCode.toUpperCase() === ownerCode);
    ownerName = cus?.customerName ?? (input.ownerName?.trim() || ownerCode);
  } else if (ownershipType === 'VMI_CONSIGNED') {
    const sup = state.suppliers.find((s) => s.supplierCode.toUpperCase() === ownerCode);
    ownerName = sup?.supplierName ?? (input.ownerName?.trim() || ownerCode);
  } else {
    ownerCode = 'INTERNAL';
    ownerName = '本厂自购';
  }

  let customerCode = '';
  let customerName = '通用共享 (不限客户)';
  if (ownershipType === 'CUSTOMER_CONSIGNED') {
    customerCode = ownerCode;
    customerName = ownerName;
  } else {
    const rawCus = (input.customerCode ?? '').trim().toUpperCase();
    if (rawCus && rawCus !== 'COMMON') {
      const cus = state.customers.find((c) => c.customerCode.toUpperCase() === rawCus);
      if (!cus && !input.customerName?.trim()) {
        throw new Error(`指定的业务对应客户不存在: ${rawCus}`);
      }
      customerCode = cus?.customerCode ?? rawCus;
      customerName = cus?.customerName ?? input.customerName?.trim() ?? rawCus;
    }
  }

  const materialKey = buildMaterialKey(skuCode, ownershipType, ownerCode, customerCode);
  const exists = state.materials.some((m) => {
    const existingKey =
      m.materialKey ??
      buildMaterialKey(m.skuCode, m.ownershipType, m.ownerCode, m.customerCode);
    return existingKey === materialKey;
  });
  if (exists) {
    throw new Error(`同一料号与业务归属组合已存在: ${skuCode} (${ownerName} / ${customerName})`);
  }

  const pkg = input.packagingCode
    ? state.packagingSpecs.find((p) => p.packagingCode === input.packagingCode)
    : undefined;
  const supplierObj = input.supplierCode
    ? state.suppliers.find((s) => s.supplierCode === input.supplierCode)
    : undefined;

  const mpq =
    input.mpq && Number(input.mpq) > 0
      ? Math.round(Number(input.mpq))
      : pkg?.defaultSpq ?? 1000;

  const next = cloneState(state);
  const material: MaterialSku = {
    ...input,
    materialKey,
    skuCode,
    mpn,
    name,
    ownershipType,
    ownerCode,
    ownerName,
    customerCode,
    customerName,
    packagingCode: pkg?.packagingCode ?? input.packagingCode,
    packagingName: pkg?.packagingName ?? input.packagingName ?? input.packageType,
    mpq,
    supplierCode: supplierObj?.supplierCode ?? input.supplierCode,
    supplierName: supplierObj?.supplierName ?? input.supplierName ?? '现货直采',
    packageType: input.packageType?.trim() || pkg?.packagingName || '标准封装',
  };
  next.materials.push(material);
  return { state: next, material };
}

export function updateMaterialSku(
  state: WmsState,
  originalKey: string,
  input: MaterialSku
): { state: WmsState; material: MaterialSku } {
  const idx = state.materials.findIndex((m) => {
    const k =
      m.materialKey ??
      buildMaterialKey(m.skuCode, m.ownershipType, m.ownerCode, m.customerCode);
    return k === originalKey;
  });
  if (idx < 0) {
    throw new Error(`未找到待修改的物料档案: ${originalKey}`);
  }

  const oldMat = state.materials[idx];
  const mpn = input.mpn.trim();
  const skuCode = (input.skuCode?.trim() || mpn).toUpperCase();
  const name = input.name.trim();
  if (!skuCode || !mpn || !name) {
    throw new Error('料号 SKU、原厂型号 MPN 和物料描述不能为空');
  }

  const ownershipType: MaterialOwnershipType = input.ownershipType ?? 'SELF_PURCHASED';
  let ownerCode =
    ownershipType === 'SELF_PURCHASED'
      ? 'INTERNAL'
      : (input.ownerCode ?? '').trim().toUpperCase();
  if (ownershipType !== 'SELF_PURCHASED' && !ownerCode) {
    throw new Error(
      ownershipType === 'CUSTOMER_CONSIGNED'
        ? '客户客供料必须指定归属客户编码'
        : 'VMI寄售料必须指定归属供应商编码'
    );
  }

  let ownerName = input.ownerName?.trim() || '本厂自购';
  if (ownershipType === 'CUSTOMER_CONSIGNED') {
    const cus = state.customers.find((c) => c.customerCode.toUpperCase() === ownerCode);
    ownerName = cus?.customerName ?? (input.ownerName?.trim() || ownerCode);
  } else if (ownershipType === 'VMI_CONSIGNED') {
    const sup = state.suppliers.find((s) => s.supplierCode.toUpperCase() === ownerCode);
    ownerName = sup?.supplierName ?? (input.ownerName?.trim() || ownerCode);
  } else {
    ownerCode = 'INTERNAL';
    ownerName = '本厂自购';
  }

  let customerCode = '';
  let customerName = '通用共享 (不限客户)';
  if (ownershipType === 'CUSTOMER_CONSIGNED') {
    customerCode = ownerCode;
    customerName = ownerName;
  } else {
    const rawCus = (input.customerCode ?? '').trim().toUpperCase();
    if (rawCus && rawCus !== 'COMMON') {
      const cus = state.customers.find((c) => c.customerCode.toUpperCase() === rawCus);
      if (!cus && !input.customerName?.trim()) {
        throw new Error(`指定的业务对应客户不存在: ${rawCus}`);
      }
      customerCode = cus?.customerCode ?? rawCus;
      customerName = cus?.customerName ?? input.customerName?.trim() ?? rawCus;
    }
  }

  const newKey = buildMaterialKey(skuCode, ownershipType, ownerCode, customerCode);
  const dupIdx = state.materials.findIndex((m, i) => {
    if (i === idx) return false;
    const k =
      m.materialKey ??
      buildMaterialKey(m.skuCode, m.ownershipType, m.ownerCode, m.customerCode);
    return k === newKey;
  });
  if (dupIdx >= 0) {
    throw new Error(`同一料号与业务归属组合已存在: ${skuCode} (${ownerName} / ${customerName})`);
  }

  const pkg = input.packagingCode
    ? state.packagingSpecs.find((p) => p.packagingCode === input.packagingCode)
    : undefined;
  const supplierObj = input.supplierCode
    ? state.suppliers.find((s) => s.supplierCode === input.supplierCode)
    : undefined;
  const mpq =
    input.mpq && Number(input.mpq) > 0
      ? Math.round(Number(input.mpq))
      : pkg?.defaultSpq ?? oldMat.mpq ?? 1000;

  const next = cloneState(state);
  const material: MaterialSku = {
    ...oldMat,
    ...input,
    materialKey: newKey,
    skuCode,
    mpn,
    name,
    ownershipType,
    ownerCode,
    ownerName,
    customerCode,
    customerName,
    packagingCode: pkg?.packagingCode ?? input.packagingCode,
    packagingName: pkg?.packagingName ?? input.packagingName ?? input.packageType,
    mpq,
    supplierCode: supplierObj?.supplierCode ?? input.supplierCode,
    supplierName: supplierObj?.supplierName ?? input.supplierName ?? oldMat.supplierName,
    packageType: input.packageType?.trim() || pkg?.packagingName || oldMat.packageType,
  };
  next.materials[idx] = material;

  // Sync linked reels for this materialKey
  for (const r of next.reels) {
    const rKey =
      r.materialKey ??
      buildMaterialKey(
        r.skuCode,
        r.ownershipType ?? 'SELF_PURCHASED',
        r.ownerCode ?? 'INTERNAL',
        r.customerCode ?? ''
      );
    if (rKey === originalKey) {
      r.materialKey = newKey;
      r.skuCode = skuCode;
      r.mpn = mpn;
      r.ownershipType = ownershipType;
      r.ownerCode = ownerCode;
      r.ownerName = ownerName;
      r.customerCode = customerCode;
      r.customerName = customerName;
      r.msdLevel = material.msdLevel;
      r.mpq = mpq;
    }
  }

  // If SKU code changed and no other material uses oldMat.skuCode, cascade rename to BOMs & open ASNs & WOs
  if (oldMat.skuCode !== skuCode && !next.materials.some((m) => m.skuCode === oldMat.skuCode)) {
    for (const b of next.boms) {
      for (const item of b.items) {
        if (item.skuCode === oldMat.skuCode) item.skuCode = skuCode;
        if (item.substituteForSku === oldMat.skuCode) item.substituteForSku = skuCode;
      }
    }
    for (const asn of next.asns) {
      for (const line of asn.lines) {
        if (line.skuCode === oldMat.skuCode) {
          line.skuCode = skuCode;
          line.mpn = mpn;
        }
      }
    }
    for (const wo of next.workOrders) {
      if (wo.status === 'COMPLETED') continue;
      for (const item of wo.bom) {
        if (item.skuCode === oldMat.skuCode) item.skuCode = skuCode;
        if (item.substituteForSku === oldMat.skuCode) item.substituteForSku = skuCode;
      }
    }
  }

  return { state: next, material };
}

export function deleteMaterialSku(
  state: WmsState,
  materialKey: string
): { state: WmsState } {
  const idx = state.materials.findIndex((m) => {
    const k =
      m.materialKey ??
      buildMaterialKey(m.skuCode, m.ownershipType, m.ownerCode, m.customerCode);
    return k === materialKey;
  });
  if (idx < 0) {
    throw new Error(`未找到待删除的物料档案: ${materialKey}`);
  }
  const target = state.materials[idx];

  const activeReels = state.reels.filter((r) => {
    const rKey =
      r.materialKey ??
      buildMaterialKey(
        r.skuCode,
        r.ownershipType ?? 'SELF_PURCHASED',
        r.ownerCode ?? 'INTERNAL',
        r.customerCode ?? ''
      );
    return (
      rKey === materialKey &&
      r.status !== 'DEPLETED' &&
      r.status !== 'SCRAPPED' &&
      r.qty > 0
    );
  });
  if (activeReels.length > 0) {
    throw new Error(
      `物料 ${target.skuCode} (${target.ownerName}) 尚有 ${activeReels.length} 盘在库或线边库存，无法删除`
    );
  }

  const hasSiblingSameSku = state.materials.some((m, i) => i !== idx && m.skuCode === target.skuCode);
  if (!hasSiblingSameSku) {
    const bomRef = state.boms.find((b) =>
      b.items.some((i) => i.skuCode === target.skuCode || i.substituteForSku === target.skuCode)
    );
    if (bomRef) {
      throw new Error(`物料 ${target.skuCode} 已被机型 BOM (${bomRef.productCode}) 引用，请先从 BOM 移除`);
    }
    const openAsnRef = state.asns.find(
      (a) =>
        (a.status === 'PENDING' || a.status === 'PARTIAL') &&
        a.lines.some((l) => l.skuCode === target.skuCode)
    );
    if (openAsnRef) {
      throw new Error(`物料 ${target.skuCode} 存在未完结的 ASN (${openAsnRef.asnNo})，无法删除`);
    }
    const woRef = state.workOrders.find(
      (w) => w.status !== 'COMPLETED' && w.bom.some((i) => i.skuCode === target.skuCode)
    );
    if (woRef) {
      throw new Error(`物料 ${target.skuCode} 已被工单 (${woRef.workOrderId}) 引用，无法删除`);
    }
  }

  const next = cloneState(state);
  next.materials.splice(idx, 1);
  return { state: next };
}

export function addWorkOrder(
  state: WmsState,
  input: {
    workOrderId?: string;
    productCode: string;
    productName: string;
    bomId?: string;
    customerCode?: string;
    customerName?: string;
    lineName: string;
    targetQty: number;
    bom: BomItem[];
  },
  now = new Date()
): { state: WmsState; workOrder: WorkOrder } {
  if (!input.productCode.trim() || !input.productName.trim()) {
    throw new Error('产品编码和名称不能为空');
  }
  if (!Number.isFinite(input.targetQty) || input.targetQty <= 0) {
    throw new Error('工单计划数量必须大于 0');
  }
  if (input.bom.length === 0) {
    throw new Error('请至少配置一条BOM物料清单');
  }

  const next = cloneState(state);
  const workOrderId = input.workOrderId?.trim() || generateId('WO', now);
  if (next.workOrders.some((w) => w.workOrderId === workOrderId)) {
    throw new Error(`工单编号已存在: ${workOrderId}`);
  }

  const customer = input.customerCode
    ? next.customers.find((c) => c.customerCode === input.customerCode)
    : undefined;

  const workOrder: WorkOrder = {
    workOrderId,
    productCode: input.productCode.trim(),
    productName: input.productName.trim(),
    bomId: input.bomId?.trim() || undefined,
    customerCode: customer?.customerCode ?? (input.customerCode?.trim() || undefined),
    customerName: customer?.customerName ?? (input.customerName?.trim() || undefined),
    lineName: input.lineName.trim() || 'SMT-Line-01',
    targetQty: input.targetQty,
    status: 'PLANNED',
    bom: input.bom,
    issuedBySku: {},
    replenishedBySku: {},
    returnedBySku: {},
    createdAt: now.toISOString(),
  };

  next.workOrders.unshift(workOrder);
  return { state: next, workOrder };
}

export interface TraceLookupResult {
  query: string;
  matchedReels: ReelItem[];
  matchedWorkOrders: WorkOrder[];
  events: TraceEvent[];
}

export function traceByQuery(state: WmsState, rawQuery: string): TraceLookupResult {
  const parsed = parseBarcodeString(rawQuery);
  const effectiveQuery = parsed.reelId || parsed.mpn || parsed.lotNumber || rawQuery;
  const q = effectiveQuery.trim().toUpperCase();
  if (!q) {
    return {
      query: '',
      matchedReels: [],
      matchedWorkOrders: [],
      events: state.traceEvents,
    };
  }

  const matchedReels = state.reels.filter(
    (r) =>
      r.reelId.toUpperCase().includes(q) ||
      (r.parentReelId && r.parentReelId.toUpperCase().includes(q)) ||
      r.lotNumber.toUpperCase().includes(q) ||
      r.mpn.toUpperCase().includes(q) ||
      r.skuCode.toUpperCase().includes(q) ||
      r.binCode.toUpperCase().includes(q)
  );

  const matchedReelIds = new Set(matchedReels.map((r) => r.reelId));

  const matchedWorkOrders = state.workOrders.filter(
    (w) =>
      w.workOrderId.toUpperCase().includes(q) ||
      w.productCode.toUpperCase().includes(q) ||
      w.productName.toUpperCase().includes(q)
  );
  const matchedWoIds = new Set(matchedWorkOrders.map((w) => w.workOrderId));

  const events = state.traceEvents.filter(
    (e) =>
      matchedReelIds.has(e.reelId) ||
      (e.workOrderId && matchedWoIds.has(e.workOrderId)) ||
      (e.workOrderId && e.workOrderId.toUpperCase().includes(q)) ||
      e.reelId.toUpperCase().includes(q) ||
      e.lotNumber.toUpperCase().includes(q) ||
      e.mpn.toUpperCase().includes(q) ||
      e.docNo.toUpperCase().includes(q) ||
      (e.waveId && e.waveId.toUpperCase().includes(q))
  );

  return {
    query: rawQuery.trim(),
    matchedReels,
    matchedWorkOrders,
    events,
  };
}

export type AnomalySeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface ShortageAnomaly {
  id: string;
  skuCode: string;
  mpn: string;
  name: string;
  unit: string;
  requiredQty: number;
  availableQty: number;
  shortageQty: number;
  affectedWorkOrders: string[];
  severity: AnomalySeverity;
  recommendation: string;
}

export interface MsdThresholdAnomaly {
  id: string;
  reelId: string;
  skuCode: string;
  mpn: string;
  binCode: string;
  qty: number;
  msdLevel: MsdLevel;
  status: 'EXPIRED_LOCKED' | 'CRITICAL_THRESHOLD';
  remainingHours: number;
  totalFloorLifeHours: number;
  severity: AnomalySeverity;
  recommendation: string;
}

export interface InventoryLevelAnomaly {
  id: string;
  skuCode: string;
  mpn: string;
  name: string;
  reelId?: string;
  binCode?: string;
  anomalyType: 'ZERO_STOCK' | 'LOW_STOCK' | 'OVERSTOCK' | 'STAGNANT_AGING';
  currentQty: number;
  thresholdQty: number;
  unit: string;
  ageDays?: number;
  severity: AnomalySeverity;
  recommendation: string;
}

export interface SmtAnomalyReport {
  shortages: ShortageAnomaly[];
  msdAlerts: MsdThresholdAnomaly[];
  inventoryLevels: InventoryLevelAnomaly[];
  totalCount: number;
  criticalCount: number;
  warningCount: number;
}

export function computeSmtAnomalies(
  state: WmsState,
  now = new Date()
): SmtAnomalyReport {
  // 1. Available in-stock quantity per SKU (excluding BAKING_REQUIRED)
  const availableBySku = new Map<string, number>();
  for (const r of state.reels) {
    if (r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED' && r.qty > 0) {
      availableBySku.set(r.skuCode, (availableBySku.get(r.skuCode) ?? 0) + r.qty);
    }
  }

  // 2. Material Shortage Alerts across active Work Orders
  const demandBySku = new Map<
    string,
    { requiredQty: number; workOrders: string[]; hasActiveLine: boolean }
  >();
  for (const wo of state.workOrders) {
    if (wo.status === 'COMPLETED') continue;
    const isRunning = wo.status === 'IN_PRODUCTION' || wo.status === 'ISSUING';
    for (const item of wo.bom) {
      if (item.itemRole === 'SUBSTITUTE') continue;
      const totalReq = calculateBomDemandQty(
        item.qtyPerBoard,
        item.attritionRate,
        wo.targetQty
      );
      const issued = wo.issuedBySku[item.skuCode] ?? 0;
      const net = Math.max(0, totalReq - issued);
      if (net <= 0) continue;
      const entry = demandBySku.get(item.skuCode) ?? {
        requiredQty: 0,
        workOrders: [],
        hasActiveLine: false,
      };
      entry.requiredQty += net;
      entry.workOrders.push(wo.workOrderId);
      if (isRunning) entry.hasActiveLine = true;
      demandBySku.set(item.skuCode, entry);
    }
  }

  const shortages: ShortageAnomaly[] = [];
  for (const [skuCode, demand] of demandBySku.entries()) {
    const avail = availableBySku.get(skuCode) ?? 0;
    if (demand.requiredQty > avail) {
      const mat = state.materials.find((m) => m.skuCode === skuCode);
      const shortageQty = demand.requiredQty - avail;
      const severity: AnomalySeverity =
        avail === 0 || demand.hasActiveLine ? 'CRITICAL' : 'WARNING';
      shortages.push({
        id: `SHORT-${skuCode}`,
        skuCode,
        mpn: mat?.mpn ?? skuCode,
        name: mat?.name ?? skuCode,
        unit: mat?.unit ?? 'PCS',
        requiredQty: demand.requiredQty,
        availableQty: avail,
        shortageQty,
        affectedWorkOrders: demand.workOrders,
        severity,
        recommendation:
          avail === 0
            ? '在库可用为 0，立即安排紧急采购收料入库'
            : `尚缺 ${shortageQty} ${mat?.unit ?? 'PCS'}，建议优先锁定来料或调整波次排产`,
      });
    }
  }

  // 3. MSD Floor-Life Threshold & Expired Baking Lock Alerts
  const msdAlerts: MsdThresholdAnomaly[] = [];
  for (const reel of state.reels) {
    if (reel.status === 'SCRAPPED' || reel.status === 'DEPLETED' || reel.qty <= 0) {
      continue;
    }
    const floorLife = MSD_FLOOR_LIFE_HOURS[reel.msdLevel];
    if (floorLife === null) continue;

    if (reel.msdState === 'BAKING_REQUIRED') {
      msdAlerts.push({
        id: `MSD-${reel.reelId}`,
        reelId: reel.reelId,
        skuCode: reel.skuCode,
        mpn: reel.mpn,
        binCode: reel.binCode,
        qty: reel.qty,
        msdLevel: reel.msdLevel,
        status: 'EXPIRED_LOCKED',
        remainingHours: 0,
        totalFloorLifeHours: floorLife,
        severity: 'CRITICAL',
        recommendation: '暴露超时已防呆锁码，立即送入125℃烘烤箱复位后解锁',
      });
    } else if (reel.msdState === 'EXPOSED' && reel.msdOpenAt) {
      const openedMs = new Date(reel.msdOpenAt).getTime();
      if (!Number.isNaN(openedMs)) {
        const elapsedHours = Math.max(0, (now.getTime() - openedMs) / 3_600_000);
        const remainingHours = Math.max(
          0,
          Number((floorLife - elapsedHours).toFixed(1))
        );
        if (remainingHours <= 0) {
          msdAlerts.push({
            id: `MSD-${reel.reelId}`,
            reelId: reel.reelId,
            skuCode: reel.skuCode,
            mpn: reel.mpn,
            binCode: reel.binCode,
            qty: reel.qty,
            msdLevel: reel.msdLevel,
            status: 'EXPIRED_LOCKED',
            remainingHours: 0,
            totalFloorLifeHours: floorLife,
            severity: 'CRITICAL',
            recommendation: '车间暴露寿命已归零，请退库烘烤除湿后再使用',
          });
        } else if (remainingHours <= 24 || remainingHours / floorLife <= 0.2) {
          msdAlerts.push({
            id: `MSD-${reel.reelId}`,
            reelId: reel.reelId,
            skuCode: reel.skuCode,
            mpn: reel.mpn,
            binCode: reel.binCode,
            qty: reel.qty,
            msdLevel: reel.msdLevel,
            status: 'CRITICAL_THRESHOLD',
            remainingHours,
            totalFloorLifeHours: floorLife,
            severity: 'WARNING',
            recommendation: `距失效仅剩 ${remainingHours}h，建议优先贴装消耗或立即退回防潮柜`,
          });
        }
      }
    }
  }

  // 4. Abnormal Inventory Levels (Zero/Low Safety Stock, Overstock, & Stagnant Aging > 30d)
  const inventoryLevels: InventoryLevelAnomaly[] = [];
  const seenLevelSku = new Set<string>();
  for (const mat of state.materials) {
    if (seenLevelSku.has(mat.skuCode)) continue;
    if (mat.ownershipType === 'CUSTOMER_CONSIGNED' && mat.safetyStock === 0) continue;
    seenLevelSku.add(mat.skuCode);
    const avail = availableBySku.get(mat.skuCode) ?? 0;
    if (avail === 0) {
      inventoryLevels.push({
        id: `LVL-ZERO-${mat.skuCode}`,
        skuCode: mat.skuCode,
        mpn: mat.mpn,
        name: mat.name,
        anomalyType: 'ZERO_STOCK',
        currentQty: 0,
        thresholdQty: mat.safetyStock,
        unit: mat.unit,
        severity: 'CRITICAL',
        recommendation: '可用库存已清零，需紧急补货入库防止产线断料',
      });
    } else if (avail < mat.safetyStock) {
      inventoryLevels.push({
        id: `LVL-LOW-${mat.skuCode}`,
        skuCode: mat.skuCode,
        mpn: mat.mpn,
        name: mat.name,
        anomalyType: 'LOW_STOCK',
        currentQty: avail,
        thresholdQty: mat.safetyStock,
        unit: mat.unit,
        severity: 'WARNING',
        recommendation: `低于安全水位 ${mat.safetyStock - avail} ${mat.unit}，建议及时发起采购补仓`,
      });
    } else if (mat.safetyStock > 0 && avail >= mat.safetyStock * 2.5) {
      inventoryLevels.push({
        id: `LVL-OVER-${mat.skuCode}`,
        skuCode: mat.skuCode,
        mpn: mat.mpn,
        name: mat.name,
        anomalyType: 'OVERSTOCK',
        currentQty: avail,
        thresholdQty: mat.safetyStock,
        unit: mat.unit,
        severity: 'INFO',
        recommendation: '库存超出安全线 2.5 倍以上，注意资金占用及焊盘氧化风险',
      });
    }
  }

  for (const reel of state.reels) {
    if (reel.status !== 'IN_STOCK' || reel.qty <= 0 || reel.issuedQty > 0) continue;
    const recMs = new Date(reel.receivedAt).getTime();
    if (Number.isNaN(recMs)) continue;
    const ageDays = Math.floor((now.getTime() - recMs) / 86_400_000);
    if (ageDays >= 30) {
      const mat = state.materials.find((m) => m.skuCode === reel.skuCode);
      inventoryLevels.push({
        id: `LVL-AGE-${reel.reelId}`,
        skuCode: reel.skuCode,
        mpn: reel.mpn,
        name: mat?.name ?? reel.mpn,
        reelId: reel.reelId,
        binCode: reel.binCode,
        anomalyType: 'STAGNANT_AGING',
        currentQty: reel.qty,
        thresholdQty: 30,
        unit: mat?.unit ?? 'PCS',
        ageDays,
        severity: 'INFO',
        recommendation: `在库静置 ${ageDays} 天未领用，建议波次发料严格FIFO优先消耗`,
      });
    }
  }

  const all = [...shortages, ...msdAlerts, ...inventoryLevels];
  const criticalCount = all.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = all.filter((a) => a.severity === 'WARNING').length;

  return {
    shortages,
    msdAlerts,
    inventoryLevels,
    totalCount: all.length,
    criticalCount,
    warningCount,
  };
}

export interface LowStockAlertItem {
  skuCode: string;
  mpn: string;
  name: string;
  category: string;
  packageType: string;
  unit: string;
  defaultBin: string;
  defaultWarehouseCode: string;
  msdLevel: MsdLevel;
  availableQty: number;
  lineSideQty: number;
  safetyStock: number;
  deficitQty: number;
  coveragePct: number;
  pendingAsnQty: number;
  pendingAsnNos: string[];
  preferredSupplierName: string;
  preferredSupplierCode: string;
  severity: 'CRITICAL' | 'WARNING';
}

export function computeLowStockAlerts(state: WmsState): LowStockAlertItem[] {
  const availableBySku = new Map<string, number>();
  const lineSideBySku = new Map<string, number>();

  for (const r of state.reels) {
    if (r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED' && r.qty > 0) {
      availableBySku.set(r.skuCode, (availableBySku.get(r.skuCode) ?? 0) + r.qty);
    } else if (r.status === 'ISSUED_TO_LINE' && r.qty > 0) {
      lineSideBySku.set(r.skuCode, (lineSideBySku.get(r.skuCode) ?? 0) + r.qty);
    }
  }

  const asnBySku = new Map<string, { qty: number; asnNos: string[] }>();
  for (const asn of state.asns) {
    if (asn.status !== 'PENDING' && asn.status !== 'PARTIAL') continue;
    for (const line of asn.lines) {
      const rem = Math.max(0, line.expectedQty - line.receivedQty);
      if (rem <= 0) continue;
      const entry = asnBySku.get(line.skuCode) ?? { qty: 0, asnNos: [] };
      entry.qty += rem;
      if (!entry.asnNos.includes(asn.asnNo)) {
        entry.asnNos.push(asn.asnNo);
      }
      asnBySku.set(line.skuCode, entry);
    }
  }

  const defaultWhFallback = state.warehouses[0]?.warehouseCode ?? 'WH-SMT-01';
  const alerts: LowStockAlertItem[] = [];

  for (const mat of state.materials) {
    if (!Number.isFinite(mat.safetyStock) || mat.safetyStock <= 0) continue;
    const availableQty = availableBySku.get(mat.skuCode) ?? 0;
    if (availableQty >= mat.safetyStock) continue;

    const deficitQty = mat.safetyStock - availableQty;
    const coveragePct = Math.min(100, Math.round((availableQty / mat.safetyStock) * 100));
    const severity: 'CRITICAL' | 'WARNING' =
      availableQty === 0 || coveragePct < 50 ? 'CRITICAL' : 'WARNING';

    const binObj = state.bins.find((b) => b.binCode === mat.defaultBin);
    const matchedSupplier =
      state.suppliers.find((s) => s.categoryTags.includes(mat.category)) ?? state.suppliers[0];
    const pendingAsn = asnBySku.get(mat.skuCode);

    alerts.push({
      skuCode: mat.skuCode,
      mpn: mat.mpn,
      name: mat.name,
      category: mat.category,
      packageType: mat.packageType,
      unit: mat.unit,
      defaultBin: mat.defaultBin,
      defaultWarehouseCode: binObj?.warehouseCode ?? defaultWhFallback,
      msdLevel: mat.msdLevel,
      availableQty,
      lineSideQty: lineSideBySku.get(mat.skuCode) ?? 0,
      safetyStock: mat.safetyStock,
      deficitQty,
      coveragePct,
      pendingAsnQty: pendingAsn?.qty ?? 0,
      pendingAsnNos: pendingAsn?.asnNos ?? [],
      preferredSupplierName: matchedSupplier?.supplierName ?? '默认供应商',
      preferredSupplierCode: matchedSupplier?.supplierCode ?? '',
      severity,
    });
  }

  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'CRITICAL' ? -1 : 1;
    }
    return a.coveragePct - b.coveragePct;
  });
}

export function addWarehouse(
  state: WmsState,
  input: {
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
    managerId: string;
    address: string;
  },
  now = new Date()
): { state: WmsState; warehouse: Warehouse } {
  const code = input.warehouseCode.trim().toUpperCase();
  const name = input.warehouseName.trim();
  if (!code || !name) {
    throw new Error('仓库编码与仓库名称不能为空');
  }
  if (state.warehouses.some((w) => w.warehouseCode.toUpperCase() === code)) {
    throw new Error(`仓库编码已存在: ${code}`);
  }
  const keeper = state.keepers.find((k) => k.keeperId === input.managerId);
  if (!keeper) {
    throw new Error('请指定有效的仓库管理员');
  }

  const next = cloneState(state);
  const warehouse: Warehouse = {
    warehouseCode: code,
    warehouseName: name,
    warehouseType: input.warehouseType.trim() || '恒温防静电电子仓',
    managerId: keeper.keeperId,
    managerName: keeper.name,
    address: input.address.trim() || '主厂区1F',
    status: 'ACTIVE',
    createdAt: now.toISOString(),
  };
  next.warehouses.push(warehouse);
  return { state: next, warehouse };
}

export function addWarehouseBin(
  state: WmsState,
  input: WarehouseBin
): { state: WmsState; bin: WarehouseBin } {
  const binCode = input.binCode.trim().toUpperCase();
  if (!binCode) {
    throw new Error('库位编码不能为空');
  }
  if (state.bins.some((b) => b.binCode.toUpperCase() === binCode)) {
    throw new Error(`库位编码已存在: ${binCode}`);
  }
  const warehouseCode = input.warehouseCode?.trim() || state.warehouses[0]?.warehouseCode;
  if (warehouseCode && !state.warehouses.some((w) => w.warehouseCode === warehouseCode)) {
    throw new Error(`所属仓库不存在: ${warehouseCode}`);
  }
  if (!Number.isFinite(input.capacityReels) || input.capacityReels <= 0) {
    throw new Error('库位容盘数必须大于 0');
  }

  const next = cloneState(state);
  const wh = next.warehouses.find((w) => w.warehouseCode === warehouseCode);
  const bin: WarehouseBin = {
    binCode,
    warehouseCode,
    zone: input.zone,
    capacityReels: Math.round(input.capacityReels),
    keeperName: input.keeperName?.trim() || wh?.managerName || '张伟',
    description: input.description.trim() || `${input.zone} 标准储位`,
  };
  next.bins.push(bin);
  return { state: next, bin };
}

export function addWarehouseKeeper(
  state: WmsState,
  input: Omit<WarehouseKeeper, 'keeperId' | 'status'> & { keeperId?: string }
): { state: WmsState; keeper: WarehouseKeeper } {
  const employeeNo = input.employeeNo.trim().toUpperCase();
  const name = input.name.trim();
  if (!employeeNo || !name) {
    throw new Error('员工工号与管理员姓名不能为空');
  }
  if (state.keepers.some((k) => k.employeeNo.toUpperCase() === employeeNo)) {
    throw new Error(`工号已存在: ${employeeNo}`);
  }
  if (!state.warehouses.some((w) => w.warehouseCode === input.warehouseCode)) {
    throw new Error(`所属仓库不存在: ${input.warehouseCode}`);
  }

  const next = cloneState(state);
  const keeper: WarehouseKeeper = {
    keeperId: input.keeperId?.trim() || `KPR-${String(next.keepers.length + 1).padStart(3, '0')}`,
    employeeNo,
    name,
    role: input.role,
    warehouseCode: input.warehouseCode,
    phone: input.phone.trim() || '-',
    shift: input.shift,
    status: 'ACTIVE',
  };
  next.keepers.push(keeper);
  return { state: next, keeper };
}

export function addSupplier(
  state: WmsState,
  input: Supplier
): { state: WmsState; supplier: Supplier } {
  const code = input.supplierCode.trim().toUpperCase();
  const name = input.supplierName.trim();
  if (!code || !name) {
    throw new Error('供应商编码和名称不能为空');
  }
  if (state.suppliers.some((s) => s.supplierCode.toUpperCase() === code)) {
    throw new Error(`供应商编码已存在: ${code}`);
  }

  const next = cloneState(state);
  const supplier: Supplier = {
    ...input,
    supplierCode: code,
    supplierName: name,
    contactName: input.contactName.trim() || '商务联系人',
    phone: input.phone.trim() || '-',
    categoryTags: input.categoryTags.trim() || '电子元器件',
    leadTimeDays: Math.max(1, Number(input.leadTimeDays) || 7),
  };
  next.suppliers.push(supplier);
  return { state: next, supplier };
}

export function addCustomer(
  state: WmsState,
  input: Customer
): { state: WmsState; customer: Customer } {
  const code = input.customerCode.trim().toUpperCase();
  const name = input.customerName.trim();
  if (!code || !name) {
    throw new Error('客户编码和客户名称不能为空');
  }
  if (state.customers.some((c) => c.customerCode.toUpperCase() === code)) {
    throw new Error(`客户编码已存在: ${code}`);
  }

  const next = cloneState(state);
  const customer: Customer = {
    ...input,
    customerCode: code,
    customerName: name,
    contactName: input.contactName.trim() || 'PMC/SQE',
    phone: input.phone.trim() || '-',
    industry: input.industry.trim() || '电子制造PCBA',
    traceRequirement: input.traceRequirement.trim() || '需IPC-1782全程UID追溯',
    deliveryAddress: input.deliveryAddress.trim() || '待补充交付地址',
  };
  next.customers.push(customer);
  return { state: next, customer };
}

export function saveBomMaster(
  state: WmsState,
  input: {
    bomId?: string;
    productCode: string;
    productName: string;
    version: string;
    customerCode?: string;
    processType: string;
    status?: 'ACTIVE' | 'DRAFT';
    items: BomItem[];
  },
  now = new Date()
): { state: WmsState; bom: BomMaster } {
  const productCode = input.productCode.trim().toUpperCase();
  const productName = input.productName.trim();
  if (!productCode || !productName) {
    throw new Error('成品编码和产品名称不能为空');
  }
  if (!input.items || input.items.length === 0) {
    throw new Error('BOM物料清单至少需要包含一条子件物料');
  }
  for (const item of input.items) {
    if (!state.materials.some((m) => m.skuCode === item.skuCode)) {
      throw new Error(`BOM子件物料不存在: ${item.skuCode}`);
    }
    if (!Number.isFinite(item.qtyPerBoard) || item.qtyPerBoard <= 0) {
      throw new Error(`物料 ${item.skuCode} 单板用量必须大于 0`);
    }
    if (item.itemRole === 'SUBSTITUTE' && !item.substituteForSku?.trim()) {
      throw new Error(`替代料 ${item.skuCode} 必须指定被替代的主/特料料号`);
    }
  }

  const next = cloneState(state);
  const bomId = input.bomId?.trim() || `BOM-${productCode.replace(/^PCBA-/, '')}`;
  const customer = input.customerCode
    ? next.customers.find((c) => c.customerCode === input.customerCode)
    : undefined;

  const bom: BomMaster = {
    bomId,
    productCode,
    productName,
    version: input.version.trim() || 'V1.0',
    customerCode: customer?.customerCode,
    customerName: customer?.customerName,
    processType: input.processType.trim() || '双面SMT + 回流焊',
    status: input.status ?? 'ACTIVE',
    items: input.items.map((item, idx) => ({
      lineId: item.lineId?.trim() || `${bomId}-L${idx + 1}`,
      skuCode: item.skuCode,
      qtyPerBoard: Number(item.qtyPerBoard),
      attritionRate: Number.isFinite(item.attritionRate) ? item.attritionRate : 0.02,
      designators: item.designators.trim() || '-',
      itemRole: item.itemRole ?? 'MAIN',
      substituteForSku:
        item.itemRole === 'SUBSTITUTE' ? item.substituteForSku?.trim() : undefined,
      substitutePriority:
        item.itemRole === 'SUBSTITUTE' ? Math.max(1, Number(item.substitutePriority) || 1) : undefined,
      substituteRatio:
        item.itemRole === 'SUBSTITUTE' ? Math.max(0.01, Number(item.substituteRatio) || 1) : undefined,
      remark: item.remark?.trim() || undefined,
    })),
    updatedAt: now.toISOString(),
  };

  const existingIdx = next.boms.findIndex((b) => b.bomId === bomId);
  if (existingIdx >= 0) {
    next.boms[existingIdx] = bom;
  } else {
    next.boms.unshift(bom);
  }
  return { state: next, bom };
}

export interface CreateAsnLineInput {
  skuCode: string;
  expectedQty: number;
  lotNumber?: string;
  dateCode?: string;
  targetBin?: string;
}

export interface CreateAsnInput {
  asnNo?: string;
  poNo: string;
  supplierCode: string;
  warehouseCode: string;
  expectedDate: string;
  purchaser: string;
  source?: 'MANUAL' | 'UPLOAD_CSV';
  notes?: string;
  lines: CreateAsnLineInput[];
}

export function createAsnOrder(
  state: WmsState,
  input: CreateAsnInput,
  now = new Date()
): { state: WmsState; asn: AsnOrder } {
  const poNo = input.poNo.trim();
  if (!poNo) {
    throw new Error('采购订单号(PO)不能为空');
  }
  const supplier = state.suppliers.find(
    (s) =>
      s.supplierCode === input.supplierCode ||
      s.supplierName === input.supplierCode
  );
  if (!supplier) {
    throw new Error(`未找到有效供应商: ${input.supplierCode}`);
  }
  if (!state.warehouses.some((w) => w.warehouseCode === input.warehouseCode)) {
    throw new Error(`目标仓库不存在: ${input.warehouseCode}`);
  }
  if (!input.lines || input.lines.length === 0) {
    throw new Error('ASN收料单至少需要一条到货物料明细');
  }

  const next = cloneState(state);
  const asnNo = input.asnNo?.trim() || generateId('ASN', now);
  if (next.asns.some((a) => a.asnNo === asnNo)) {
    throw new Error(`ASN单号已存在: ${asnNo}`);
  }

  const lines: AsnLine[] = input.lines.map((line, idx) => {
    const mat = next.materials.find(
      (m) =>
        m.skuCode.toUpperCase() === line.skuCode.trim().toUpperCase() ||
        m.mpn.toUpperCase() === line.skuCode.trim().toUpperCase()
    );
    if (!mat) {
      throw new Error(`ASN第 ${idx + 1} 行未找到物料 SKU/MPN: ${line.skuCode}`);
    }
    if (!Number.isFinite(line.expectedQty) || line.expectedQty <= 0) {
      throw new Error(`物料 ${mat.mpn} 预计到货数量必须大于 0`);
    }
    return {
      lineId: `ASNL-${Date.now().toString(36).slice(-4).toUpperCase()}-${idx + 1}`,
      skuCode: mat.skuCode,
      mpn: mat.mpn,
      expectedQty: Math.round(line.expectedQty),
      receivedQty: 0,
      lotNumber: line.lotNumber?.trim() || undefined,
      dateCode: line.dateCode?.trim() || undefined,
      targetBin: line.targetBin?.trim() || mat.defaultBin,
    };
  });

  const asn: AsnOrder = {
    asnNo,
    poNo,
    supplierCode: supplier.supplierCode,
    supplierName: supplier.supplierName,
    warehouseCode: input.warehouseCode,
    expectedDate: input.expectedDate.trim() || now.toISOString().slice(0, 10),
    purchaser: input.purchaser.trim() || '采购专员',
    source: input.source ?? 'MANUAL',
    status: 'PENDING',
    notes: input.notes?.trim() || undefined,
    createdAt: now.toISOString(),
    lines,
  };

  next.asns.unshift(asn);
  return { state: next, asn };
}

export interface ParsedAsnCsvPreview {
  poNo: string;
  supplierCode: string;
  supplierName: string;
  warehouseCode: string;
  expectedDate: string;
  purchaser: string;
  lines: CreateAsnLineInput[];
}

/**
 * Parses procurement CSV lines:
 * Header (optional): PO号,供应商,预计到货日,SKU/MPN,数量,批次Lot,周期DateCode,建议库位
 */
export function parseAsnCsv(
  csvText: string,
  state: WmsState,
  defaults?: { warehouseCode?: string; purchaser?: string }
): ParsedAsnCsvPreview {
  const rawLines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    throw new Error('请粘贴或上传采购ASN CSV内容');
  }

  const rows: string[][] = rawLines.map((line) =>
    line.split(/[,;\t]/).map((cell) => cell.trim().replace(/^"|"$/g, ''))
  );

  // Skip header row if detected
  const firstCell = rows[0][0]?.toUpperCase() ?? '';
  const dataRows =
    firstCell.includes('PO') || firstCell.includes('采购') || firstCell.includes('单号')
      ? rows.slice(1)
      : rows;

  if (dataRows.length === 0) {
    throw new Error('CSV文件中仅有表头，未检测到有效物料行');
  }

  let poNo = '';
  let matchedSupplier: Supplier | undefined;
  let expectedDate = '';
  const parsedLines: CreateAsnLineInput[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cols = dataRows[i];
    if (cols.length < 5) {
      throw new Error(
        `第 ${i + 1} 行格式不完整（至少需要: PO号,供应商,到货日期,SKU/MPN,数量）`
      );
    }
    const [rowPo, rowSup, rowDate, rowSkuOrMpn, rowQtyStr, rowLot, rowDc, rowBin] = cols;
    if (!poNo && rowPo) poNo = rowPo;
    if (!expectedDate && rowDate) expectedDate = rowDate;

    if (!matchedSupplier && rowSup) {
      const q = rowSup.toUpperCase();
      matchedSupplier = state.suppliers.find(
        (s) =>
          s.supplierCode.toUpperCase() === q ||
          s.supplierName.toUpperCase() === q ||
          s.supplierName.toUpperCase().includes(q)
      );
      if (!matchedSupplier) {
        throw new Error(`第 ${i + 1} 行未匹配到供应商档案: "${rowSup}"，请先在供应商管理中维护`);
      }
    }

    const matQ = (rowSkuOrMpn ?? '').toUpperCase();
    const mat = state.materials.find(
      (m) => m.skuCode.toUpperCase() === matQ || m.mpn.toUpperCase() === matQ
    );
    if (!mat) {
      throw new Error(`第 ${i + 1} 行未匹配到物料SKU/MPN: "${rowSkuOrMpn}"`);
    }

    const expectedQty = Number(rowQtyStr);
    if (!Number.isFinite(expectedQty) || expectedQty <= 0) {
      throw new Error(`第 ${i + 1} 行数量无效: "${rowQtyStr}"`);
    }

    parsedLines.push({
      skuCode: mat.skuCode,
      expectedQty: Math.round(expectedQty),
      lotNumber: rowLot || undefined,
      dateCode: rowDc || undefined,
      targetBin: rowBin || mat.defaultBin,
    });
  }

  if (!poNo) {
    throw new Error('CSV数据缺少采购订单号(PO)');
  }
  if (!matchedSupplier) {
    throw new Error('CSV数据缺少有效供应商名称或编码');
  }

  return {
    poNo,
    supplierCode: matchedSupplier.supplierCode,
    supplierName: matchedSupplier.supplierName,
    warehouseCode: defaults?.warehouseCode || state.warehouses[0]?.warehouseCode || 'WH-SMT-01',
    expectedDate: expectedDate || new Date().toISOString().slice(0, 10),
    purchaser: defaults?.purchaser?.trim() || '采购导入',
    lines: parsedLines,
  };
}

export function importAsnFromCsv(
  state: WmsState,
  input: {
    csvText: string;
    warehouseCode?: string;
    purchaser?: string;
    notes?: string;
  },
  now = new Date()
): { state: WmsState; asn: AsnOrder } {
  const preview = parseAsnCsv(input.csvText, state, {
    warehouseCode: input.warehouseCode,
    purchaser: input.purchaser,
  });

  return createAsnOrder(
    state,
    {
      poNo: preview.poNo,
      supplierCode: preview.supplierCode,
      warehouseCode: preview.warehouseCode,
      expectedDate: preview.expectedDate,
      purchaser: preview.purchaser,
      source: 'UPLOAD_CSV',
      notes: input.notes?.trim() || '采购CSV批量导入生成ASN收料通知单',
      lines: preview.lines,
    },
    now
  );
}

export function cancelAsnOrder(
  state: WmsState,
  asnNo: string
): { state: WmsState; asn: AsnOrder } {
  const next = cloneState(state);
  const asn = next.asns.find((a) => a.asnNo === asnNo);
  if (!asn) {
    throw new Error(`ASN单号不存在: ${asnNo}`);
  }
  if (asn.status === 'COMPLETED') {
    throw new Error('已全部收料完成的ASN不能作废');
  }
  asn.status = 'CANCELLED';
  return { state: next, asn };
}

export function addPackagingSpec(
  state: WmsState,
  input: PackagingSpec
): { state: WmsState; spec: PackagingSpec } {
  const packagingCode = input.packagingCode.trim().toUpperCase();
  const packagingName = input.packagingName.trim();
  if (!packagingCode || !packagingName) {
    throw new Error('包装方式编码与名称不能为空');
  }
  if (!Number.isFinite(input.defaultSpq) || input.defaultSpq <= 0) {
    throw new Error('标准最小包装数量 (SPQ) 必须大于 0');
  }
  if (
    state.packagingSpecs.some(
      (p) => p.packagingCode.toUpperCase() === packagingCode
    )
  ) {
    throw new Error(`包装方式编码已存在: ${packagingCode}`);
  }

  const next = cloneState(state);
  const spec: PackagingSpec = {
    ...input,
    packagingCode,
    packagingName,
    reelDiameter: input.reelDiameter.trim() || '-',
    tapeWidthMm: Math.max(0, Number(input.tapeWidthMm) || 0),
    pitchMm: Math.max(0, Number(input.pitchMm) || 0),
    defaultSpq: Math.round(input.defaultSpq),
    description: input.description.trim() || packagingName,
  };
  next.packagingSpecs.push(spec);
  return { state: next, spec };
}

export function saveBarcodeRule(
  state: WmsState,
  input: Omit<BarcodeRule, 'ruleId' | 'supplierName'> & {
    ruleId?: string;
    supplierName?: string;
  }
): { state: WmsState; rule: BarcodeRule } {
  const ruleName = input.ruleName.trim();
  if (!ruleName) {
    throw new Error('条码解析规则名称不能为空');
  }
  const supplierCode = input.supplierCode.trim().toUpperCase() || 'ALL';
  const supplier =
    supplierCode === 'ALL'
      ? undefined
      : state.suppliers.find((s) => s.supplierCode.toUpperCase() === supplierCode);

  const next = cloneState(state);
  const ruleId =
    input.ruleId?.trim().toUpperCase() ||
    `RULE-${String(next.barcodeRules.length + 1).padStart(3, '0')}`;
  const rule: BarcodeRule = {
    ruleId,
    ruleName,
    supplierCode,
    supplierName:
      supplier?.supplierName ??
      (supplierCode === 'ALL'
        ? '全部供应商 (通用兜底)'
        : input.supplierName?.trim() || supplierCode),
    formatType: input.formatType,
    delimiter: input.delimiter,
    fieldMap: input.fieldMap,
    sampleBarcode: input.sampleBarcode.trim(),
    enabled: input.enabled ?? true,
  };

  const idx = next.barcodeRules.findIndex((r) => r.ruleId === ruleId);
  if (idx >= 0) {
    next.barcodeRules[idx] = rule;
  } else {
    next.barcodeRules.unshift(rule);
  }
  return { state: next, rule };
}

export function saveLabelTemplate(
  state: WmsState,
  input: Omit<LabelTemplate, 'templateId'> & { templateId?: string }
): { state: WmsState; template: LabelTemplate } {
  const templateName = input.templateName.trim();
  if (!templateName) {
    throw new Error('标签模板名称不能为空');
  }
  const next = cloneState(state);
  const templateId =
    input.templateId?.trim().toUpperCase() ||
    `TPL-${String(next.labelTemplates.length + 1).padStart(3, '0')}`;

  if (input.isDefault) {
    for (const tpl of next.labelTemplates) {
      tpl.isDefault = false;
    }
  }

  const barcodeHeightMm =
    typeof input.barcodeHeightMm === 'number' && Number.isFinite(input.barcodeHeightMm)
      ? Math.max(4, Math.min(36, Math.round(input.barcodeHeightMm * 10) / 10))
      : 8;

  const customWidthMm =
    typeof input.customWidthMm === 'number' && Number.isFinite(input.customWidthMm)
      ? Math.max(20, Math.min(200, Math.round(input.customWidthMm * 10) / 10))
      : undefined;
  const customHeightMm =
    typeof input.customHeightMm === 'number' && Number.isFinite(input.customHeightMm)
      ? Math.max(10, Math.min(200, Math.round(input.customHeightMm * 10) / 10))
      : undefined;
  const offsetXMm =
    typeof input.offsetXMm === 'number' && Number.isFinite(input.offsetXMm)
      ? Math.max(-30, Math.min(30, Math.round(input.offsetXMm * 10) / 10))
      : 0;
  const offsetYMm =
    typeof input.offsetYMm === 'number' && Number.isFinite(input.offsetYMm)
      ? Math.max(-30, Math.min(30, Math.round(input.offsetYMm * 10) / 10))
      : 0;

  const template: LabelTemplate = {
    ...input,
    templateId,
    templateName,
    customWidthMm,
    customHeightMm,
    dpi: normalizeDpi(input.dpi),
    offsetXMm,
    offsetYMm,
    barcodeType: input.barcodeType ?? 'CODE128',
    zplMode: input.zplMode ?? 'VISUAL',
    fontScale: input.fontScale ?? 'STANDARD',
    barcodeHeightMm,
    elementOrder: normalizeElementOrder(input.elementOrder),
    elementLayouts: normalizeElementLayouts({
      paperSize: input.paperSize,
      customWidthMm,
      customHeightMm,
      elementLayouts: input.elementLayouts,
      elementOrder: input.elementOrder,
      showFields: input.showFields,
      fontScale: input.fontScale,
      barcodeHeightMm,
    }),
    customZpl: input.customZpl ?? '',
    headerTitle: input.headerTitle.trim() || 'SMT 料盘唯一标识',
    footerNote: input.footerNote.trim() || 'IPC-1782 全程追溯',
  };

  const idx = next.labelTemplates.findIndex((t) => t.templateId === templateId);
  if (idx >= 0) {
    next.labelTemplates[idx] = template;
  } else {
    next.labelTemplates.push(template);
  }
  return { state: next, template };
}

export function savePrinterConfig(
  state: WmsState,
  input: Partial<ZebraPrinterConfig>
): { state: WmsState; printerConfig: ZebraPrinterConfig } {
  const current = state.printerConfig ?? {
    mode: 'LAN_TCP' as const,
    host: '192.168.10.88',
    port: 9100,
    browserPrintUrl: 'http://127.0.0.1:9100',
    selectedDeviceName: '',
    darkness: 18,
    printSpeed: 4,
  };
  const mode = input.mode ?? current.mode;
  const host = (input.host ?? current.host).trim();
  const port = Number(input.port ?? current.port);
  const browserPrintUrl = (input.browserPrintUrl ?? current.browserPrintUrl).trim();
  const darkness = Number(input.darkness ?? current.darkness);
  const printSpeed = Number(input.printSpeed ?? current.printSpeed);

  if (mode === 'LAN_TCP' && !host) {
    throw new Error('局域网打印模式下，Zebra 打印机 IP/主机名不能为空');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('TCP 端口号必须在 1 - 65535 之间（Zebra 默认 9100）');
  }
  if (!Number.isFinite(darkness) || darkness < 0 || darkness > 30) {
    throw new Error('打印黑度 (^MD) 范围应为 0 - 30');
  }
  if (!Number.isFinite(printSpeed) || printSpeed < 2 || printSpeed > 12) {
    throw new Error('打印速度 (^PR) 范围应为 2 - 12 ips');
  }

  const next = cloneState(state);
  const printerConfig: ZebraPrinterConfig = {
    mode,
    host: host || '192.168.10.88',
    port,
    browserPrintUrl: browserPrintUrl || 'http://127.0.0.1:9100',
    selectedDeviceName: (input.selectedDeviceName ?? current.selectedDeviceName ?? '').trim(),
    darkness: Math.round(darkness),
    printSpeed: Math.round(printSpeed),
  };
  next.printerConfig = printerConfig;
  return { state: next, printerConfig };
}

export function updatePackagingSpec(
  state: WmsState,
  packagingCode: string,
  input: PackagingSpec
): { state: WmsState; spec: PackagingSpec } {
  const code = packagingCode.trim().toUpperCase();
  const idx = state.packagingSpecs.findIndex((p) => p.packagingCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`包装方式编码不存在: ${code}`);
  }
  const packagingName = input.packagingName.trim();
  if (!packagingName) {
    throw new Error('包装方式名称不能为空');
  }
  if (!Number.isFinite(input.defaultSpq) || input.defaultSpq <= 0) {
    throw new Error('标准最小包装数量 (SPQ) 必须大于 0');
  }

  const next = cloneState(state);
  const spec: PackagingSpec = {
    ...input,
    packagingCode: next.packagingSpecs[idx].packagingCode,
    packagingName,
    reelDiameter: input.reelDiameter.trim() || '-',
    tapeWidthMm: Math.max(0, Number(input.tapeWidthMm) || 0),
    pitchMm: Math.max(0, Number(input.pitchMm) || 0),
    defaultSpq: Math.round(input.defaultSpq),
    description: input.description.trim() || packagingName,
  };
  next.packagingSpecs[idx] = spec;
  for (const m of next.materials) {
    if (m.packagingCode === spec.packagingCode) {
      m.packagingName = spec.packagingName;
      m.packageType = spec.packagingName;
    }
  }
  return { state: next, spec };
}

export function deletePackagingSpec(
  state: WmsState,
  packagingCode: string
): { state: WmsState } {
  const code = packagingCode.trim().toUpperCase();
  const idx = state.packagingSpecs.findIndex((p) => p.packagingCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`包装方式编码不存在: ${code}`);
  }
  const refs = state.materials.filter((m) => m.packagingCode?.toUpperCase() === code);
  if (refs.length > 0) {
    throw new Error(`包装规格 ${code} 正被 ${refs.length} 条物料档案引用，无法删除`);
  }
  const next = cloneState(state);
  next.packagingSpecs.splice(idx, 1);
  return { state: next };
}

export function deleteBarcodeRule(
  state: WmsState,
  ruleId: string
): { state: WmsState } {
  const idx = state.barcodeRules.findIndex((r) => r.ruleId === ruleId);
  if (idx < 0) {
    throw new Error(`条码规则不存在: ${ruleId}`);
  }
  const next = cloneState(state);
  next.barcodeRules.splice(idx, 1);
  return { state: next };
}

export function deleteLabelTemplate(
  state: WmsState,
  templateId: string
): { state: WmsState } {
  const idx = state.labelTemplates.findIndex((t) => t.templateId === templateId);
  if (idx < 0) {
    throw new Error(`标签模板不存在: ${templateId}`);
  }
  if (state.labelTemplates.length <= 1) {
    throw new Error('至少需保留一套默认标签打印模板');
  }
  const next = cloneState(state);
  const [removed] = next.labelTemplates.splice(idx, 1);
  if (removed.isDefault && next.labelTemplates.length > 0) {
    next.labelTemplates[0].isDefault = true;
  }
  return { state: next };
}

export function updateWarehouse(
  state: WmsState,
  warehouseCode: string,
  input: {
    warehouseName: string;
    warehouseType: string;
    managerId: string;
    address: string;
    status?: 'ACTIVE' | 'INACTIVE';
  }
): { state: WmsState; warehouse: Warehouse } {
  const code = warehouseCode.trim().toUpperCase();
  const idx = state.warehouses.findIndex((w) => w.warehouseCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`仓库不存在: ${code}`);
  }
  const warehouseName = input.warehouseName.trim();
  if (!warehouseName) {
    throw new Error('仓库名称不能为空');
  }
  const keeper = state.keepers.find((k) => k.keeperId === input.managerId);
  if (!keeper) {
    throw new Error('请指定有效的仓库管理员');
  }
  const next = cloneState(state);
  const existing = next.warehouses[idx];
  const updated: Warehouse = {
    ...existing,
    warehouseName,
    warehouseType: input.warehouseType.trim() || existing.warehouseType,
    managerId: keeper.keeperId,
    managerName: keeper.name,
    address: input.address.trim() || existing.address,
    status: input.status ?? existing.status,
  };
  next.warehouses[idx] = updated;
  return { state: next, warehouse: updated };
}

export function deleteWarehouse(
  state: WmsState,
  warehouseCode: string
): { state: WmsState } {
  const code = warehouseCode.trim().toUpperCase();
  const idx = state.warehouses.findIndex((w) => w.warehouseCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`仓库不存在: ${code}`);
  }
  const binRefs = state.bins.filter((b) => (b.warehouseCode ?? '').toUpperCase() === code);
  if (binRefs.length > 0) {
    throw new Error(`仓库 ${code} 下仍有 ${binRefs.length} 个库位，请先清理库位`);
  }
  const keeperRefs = state.keepers.filter((k) => k.warehouseCode.toUpperCase() === code);
  if (keeperRefs.length > 0) {
    throw new Error(`仓库 ${code} 下仍绑定有 ${keeperRefs.length} 名管理员，请先变更其所属仓库`);
  }
  const openAsn = state.asns.find(
    (a) =>
      (a.status === 'PENDING' || a.status === 'PARTIAL') &&
      a.warehouseCode.toUpperCase() === code
  );
  if (openAsn) {
    throw new Error(`仓库 ${code} 存在待收 ASN (${openAsn.asnNo})，无法删除`);
  }
  const next = cloneState(state);
  next.warehouses.splice(idx, 1);
  return { state: next };
}

export function updateWarehouseBin(
  state: WmsState,
  binCode: string,
  input: Omit<WarehouseBin, 'binCode'> & { binCode?: string }
): { state: WmsState; bin: WarehouseBin } {
  const code = binCode.trim().toUpperCase();
  const idx = state.bins.findIndex((b) => b.binCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`库位不存在: ${code}`);
  }
  const warehouseCode = input.warehouseCode?.trim() || state.bins[idx].warehouseCode;
  if (warehouseCode && !state.warehouses.some((w) => w.warehouseCode === warehouseCode)) {
    throw new Error(`所属仓库不存在: ${warehouseCode}`);
  }
  if (!Number.isFinite(input.capacityReels) || input.capacityReels <= 0) {
    throw new Error('库位容盘数必须大于 0');
  }
  const next = cloneState(state);
  const existing = next.bins[idx];
  const updated: WarehouseBin = {
    ...existing,
    warehouseCode,
    zone: input.zone,
    capacityReels: Math.round(input.capacityReels),
    keeperName: input.keeperName?.trim() || existing.keeperName,
    description: input.description.trim() || existing.description,
  };
  next.bins[idx] = updated;
  return { state: next, bin: updated };
}

export function deleteWarehouseBin(
  state: WmsState,
  binCode: string
): { state: WmsState } {
  const code = binCode.trim().toUpperCase();
  const idx = state.bins.findIndex((b) => b.binCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`库位不存在: ${code}`);
  }
  const activeReels = state.reels.filter(
    (r) =>
      r.binCode.toUpperCase() === code &&
      r.status !== 'DEPLETED' &&
      r.status !== 'SCRAPPED' &&
      r.qty > 0
  );
  if (activeReels.length > 0) {
    throw new Error(`库位 ${code} 尚有 ${activeReels.length} 盘物料在库，无法删除`);
  }
  const matRefs = state.materials.filter((m) => m.defaultBin.toUpperCase() === code);
  if (matRefs.length > 0) {
    throw new Error(`库位 ${code} 正被 ${matRefs.length} 条物料作为默认库位引用，无法删除`);
  }
  const next = cloneState(state);
  next.bins.splice(idx, 1);
  return { state: next };
}

export function updateWarehouseKeeper(
  state: WmsState,
  keeperId: string,
  input: Omit<WarehouseKeeper, 'keeperId' | 'status'> & { status?: 'ACTIVE' | 'INACTIVE' }
): { state: WmsState; keeper: WarehouseKeeper } {
  const idx = state.keepers.findIndex((k) => k.keeperId === keeperId);
  if (idx < 0) {
    throw new Error(`管理员档案不存在: ${keeperId}`);
  }
  const employeeNo = input.employeeNo.trim().toUpperCase();
  const name = input.name.trim();
  if (!employeeNo || !name) {
    throw new Error('员工工号与管理员姓名不能为空');
  }
  if (
    state.keepers.some(
      (k, i) => i !== idx && k.employeeNo.toUpperCase() === employeeNo
    )
  ) {
    throw new Error(`工号已存在: ${employeeNo}`);
  }
  if (!state.warehouses.some((w) => w.warehouseCode === input.warehouseCode)) {
    throw new Error(`所属仓库不存在: ${input.warehouseCode}`);
  }
  const next = cloneState(state);
  const oldKeeper = next.keepers[idx];
  const updated: WarehouseKeeper = {
    ...oldKeeper,
    employeeNo,
    name,
    role: input.role,
    warehouseCode: input.warehouseCode,
    phone: input.phone.trim() || '-',
    shift: input.shift,
    status: input.status ?? oldKeeper.status,
  };
  next.keepers[idx] = updated;
  for (const wh of next.warehouses) {
    if (wh.managerId === keeperId) {
      wh.managerName = updated.name;
    }
  }
  if (oldKeeper.name !== updated.name) {
    for (const b of next.bins) {
      if (b.keeperName === oldKeeper.name) {
        b.keeperName = updated.name;
      }
    }
  }
  return { state: next, keeper: updated };
}

export function deleteWarehouseKeeper(
  state: WmsState,
  keeperId: string
): { state: WmsState } {
  const idx = state.keepers.findIndex((k) => k.keeperId === keeperId);
  if (idx < 0) {
    throw new Error(`管理员档案不存在: ${keeperId}`);
  }
  const managedWh = state.warehouses.find((w) => w.managerId === keeperId);
  if (managedWh) {
    throw new Error(
      `该员工正担任仓库「${managedWh.warehouseName}」主负责人，请先变更仓库负责人后再删除`
    );
  }
  const next = cloneState(state);
  next.keepers.splice(idx, 1);
  return { state: next };
}

export function updateSupplier(
  state: WmsState,
  supplierCode: string,
  input: Omit<Supplier, 'supplierCode'> & { supplierCode?: string }
): { state: WmsState; supplier: Supplier } {
  const code = supplierCode.trim().toUpperCase();
  const idx = state.suppliers.findIndex((s) => s.supplierCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`供应商不存在: ${code}`);
  }
  const name = input.supplierName.trim();
  if (!name) {
    throw new Error('供应商名称不能为空');
  }
  const next = cloneState(state);
  const canonicalCode = next.suppliers[idx].supplierCode;
  const updated: Supplier = {
    ...next.suppliers[idx],
    ...input,
    supplierCode: canonicalCode,
    supplierName: name,
    contactName: input.contactName.trim() || '商务联系人',
    phone: input.phone.trim() || '-',
    categoryTags: input.categoryTags.trim() || '电子元器件',
    leadTimeDays: Math.max(1, Number(input.leadTimeDays) || 7),
  };
  next.suppliers[idx] = updated;

  for (const m of next.materials) {
    if (m.supplierCode === canonicalCode) {
      m.supplierName = updated.supplierName;
    }
    if (m.ownershipType === 'VMI_CONSIGNED' && m.ownerCode === canonicalCode) {
      m.ownerName = updated.supplierName;
    }
  }
  for (const rule of next.barcodeRules) {
    if (rule.supplierCode === canonicalCode) {
      rule.supplierName = updated.supplierName;
    }
  }
  return { state: next, supplier: updated };
}

export function deleteSupplier(
  state: WmsState,
  supplierCode: string
): { state: WmsState } {
  const code = supplierCode.trim().toUpperCase();
  const idx = state.suppliers.findIndex((s) => s.supplierCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`供应商不存在: ${code}`);
  }
  const matRef = state.materials.find(
    (m) =>
      m.supplierCode?.toUpperCase() === code ||
      (m.ownershipType === 'VMI_CONSIGNED' && m.ownerCode?.toUpperCase() === code)
  );
  if (matRef) {
    throw new Error(`供应商 ${code} 已被物料主数据 (${matRef.skuCode}) 引用，无法删除`);
  }
  const asnRef = state.asns.find(
    (a) =>
      (a.status === 'PENDING' || a.status === 'PARTIAL') &&
      a.supplierCode.toUpperCase() === code
  );
  if (asnRef) {
    throw new Error(`供应商 ${code} 存在未完结 ASN (${asnRef.asnNo})，无法删除`);
  }
  const ruleRef = state.barcodeRules.find((r) => r.supplierCode.toUpperCase() === code);
  if (ruleRef) {
    throw new Error(`供应商 ${code} 绑定了条码规则 (${ruleRef.ruleName})，请先删除规则`);
  }
  const next = cloneState(state);
  next.suppliers.splice(idx, 1);
  return { state: next };
}

export function updateCustomer(
  state: WmsState,
  customerCode: string,
  input: Omit<Customer, 'customerCode'> & { customerCode?: string }
): { state: WmsState; customer: Customer } {
  const code = customerCode.trim().toUpperCase();
  const idx = state.customers.findIndex((c) => c.customerCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`客户不存在: ${code}`);
  }
  const name = input.customerName.trim();
  if (!name) {
    throw new Error('客户名称不能为空');
  }
  const next = cloneState(state);
  const canonicalCode = next.customers[idx].customerCode;
  const updated: Customer = {
    ...next.customers[idx],
    ...input,
    customerCode: canonicalCode,
    customerName: name,
    contactName: input.contactName.trim() || 'PMC/SQE',
    phone: input.phone.trim() || '-',
    industry: input.industry.trim() || '电子制造PCBA',
    traceRequirement: input.traceRequirement.trim() || '需IPC-1782全程UID追溯',
    deliveryAddress: input.deliveryAddress.trim() || '待补充交付地址',
  };
  next.customers[idx] = updated;

  for (const m of next.materials) {
    if (m.customerCode === canonicalCode) m.customerName = updated.customerName;
    if (m.ownershipType === 'CUSTOMER_CONSIGNED' && m.ownerCode === canonicalCode) {
      m.ownerName = updated.customerName;
    }
  }
  for (const r of next.reels) {
    if (r.customerCode === canonicalCode) r.customerName = updated.customerName;
    if (r.ownershipType === 'CUSTOMER_CONSIGNED' && r.ownerCode === canonicalCode) {
      r.ownerName = updated.customerName;
    }
  }
  for (const b of next.boms) {
    if (b.customerCode === canonicalCode) b.customerName = updated.customerName;
  }
  for (const wo of next.workOrders) {
    if (wo.status !== 'COMPLETED' && wo.customerCode === canonicalCode) {
      wo.customerName = updated.customerName;
    }
  }
  return { state: next, customer: updated };
}

export function deleteCustomer(
  state: WmsState,
  customerCode: string
): { state: WmsState } {
  const code = customerCode.trim().toUpperCase();
  const idx = state.customers.findIndex((c) => c.customerCode.toUpperCase() === code);
  if (idx < 0) {
    throw new Error(`客户不存在: ${code}`);
  }
  const matRef = state.materials.find(
    (m) =>
      m.customerCode?.toUpperCase() === code ||
      (m.ownershipType === 'CUSTOMER_CONSIGNED' && m.ownerCode?.toUpperCase() === code)
  );
  if (matRef) {
    throw new Error(`客户 ${code} 已被物料主数据 (${matRef.skuCode}) 绑定，无法删除`);
  }
  const bomRef = state.boms.find((b) => b.customerCode?.toUpperCase() === code);
  if (bomRef) {
    throw new Error(`客户 ${code} 已关联机型 BOM (${bomRef.productCode})，无法删除`);
  }
  const woRef = state.workOrders.find(
    (w) => w.status !== 'COMPLETED' && w.customerCode?.toUpperCase() === code
  );
  if (woRef) {
    throw new Error(`客户 ${code} 关联有在制工单 (${woRef.workOrderId})，无法删除`);
  }
  const next = cloneState(state);
  next.customers.splice(idx, 1);
  return { state: next };
}

export function deleteBomMaster(
  state: WmsState,
  bomId: string
): { state: WmsState } {
  const idx = state.boms.findIndex((b) => b.bomId === bomId);
  if (idx < 0) {
    throw new Error(`机型 BOM 不存在: ${bomId}`);
  }
  const target = state.boms[idx];
  const woRef = state.workOrders.find(
    (w) => w.status !== 'COMPLETED' && w.bomId === bomId
  );
  if (woRef) {
    throw new Error(`机型 BOM (${target.productCode}) 已被工单 ${woRef.workOrderId} 引用，无法删除`);
  }
  const next = cloneState(state);
  next.boms.splice(idx, 1);
  return { state: next };
}




