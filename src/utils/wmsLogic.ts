import type {
  AsnLine,
  AsnOrder,
  BomItem,
  BomMaster,
  Customer,
  CycleCountTask,
  MaterialSku,
  MsdLevel,
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
} from '../types/wms';

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

  return {
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
    customers:
      Array.isArray(raw.customers) && raw.customers.length > 0
        ? raw.customers
        : fallbackSeed.customers,
    boms:
      Array.isArray(raw.boms) && raw.boms.length > 0 ? raw.boms : fallbackSeed.boms,
    asns:
      Array.isArray(raw.asns) && raw.asns.length > 0 ? raw.asns : fallbackSeed.asns,
    materials: Array.isArray(raw.materials) ? raw.materials : fallbackSeed.materials,
    bins,
    reels: Array.isArray(raw.reels) ? raw.reels : fallbackSeed.reels,
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
}

/**
 * Parses either a plain UID (e.g. RL261015-001) or an IPC-1782 / supplier composite QR string
 * such as "UID:RL261117-001|P:STM32F407VET6|L:ST2645A|D:2645|Q:1000"
 */
export function parseBarcodeString(raw: string): ParsedBarcode {
  const trimmed = raw.trim();
  if (!trimmed) return { raw: '' };

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
    if (r.status === 'IN_STOCK' && r.msdState !== 'BAKING_REQUIRED' && r.qty > 0) {
      stockBySku.set(r.skuCode, (stockBySku.get(r.skuCode) ?? 0) + r.qty);
    }
  }

  const lines: KittingLineStatus[] = wo.bom.map((b) => {
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
  const material = state.materials.find((m) => m.skuCode === input.skuCode);
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
  let linkedSupplier = input.supplier.trim() || '现货采购';
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

  const receiptDocNo = input.receiptDocNo?.trim() || asnNo || generateId('RCV', now);
  const reel: ReelItem = {
    reelId,
    skuCode: material.skuCode,
    mpn: material.mpn,
    lotNumber: input.lotNumber.trim(),
    dateCode: input.dateCode.trim(),
    supplier: linkedSupplier,
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
}

export function consolidateWaveDemand(
  workOrders: WorkOrder[],
  materials: MaterialSku[]
): DemandItem[] {
  const map = new Map<string, number>();
  for (const wo of workOrders) {
    for (const item of wo.bom) {
      const totalRequired = calculateBomDemandQty(
        item.qtyPerBoard,
        item.attritionRate,
        wo.targetQty
      );
      const alreadyIssued = wo.issuedBySku[item.skuCode] ?? 0;
      const net = Math.max(0, totalRequired - alreadyIssued);
      if (net > 0) {
        map.set(item.skuCode, (map.get(item.skuCode) ?? 0) + net);
      }
    }
  }

  const demands: DemandItem[] = [];
  for (const [skuCode, requiredQty] of map.entries()) {
    const mat = materials.find((m) => m.skuCode === skuCode);
    demands.push({
      skuCode,
      mpn: mat?.mpn ?? skuCode,
      requiredQty,
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
    for (const reel of eligible) {
      if (need <= 0) break;
      if (reel.skuCode !== demand.skuCode) continue;
      const avail = remainingByReel.get(reel.reelId) ?? 0;
      if (avail <= 0) continue;

      const pickQty = Math.min(avail, need);
      remainingByReel.set(reel.reelId, avail - pickQty);
      need -= pickQty;

      allocations.push({
        id: `WA-${idx++}`,
        skuCode: demand.skuCode,
        mpn: demand.mpn,
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
    // Check if they scanned a reel of the same SKU with newer DateCode (FIFO violation guard!)
    const scannedReel = next.reels.find((r) => r.reelId === targetReelId);
    if (scannedReel) {
      const pendingSameSku = wave.allocations.find(
        (a) => a.skuCode === scannedReel.skuCode && a.status === 'PENDING'
      );
      if (pendingSameSku) {
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
      skuCode: parentReel.skuCode,
      mpn: parentReel.mpn,
      lotNumber: parentReel.lotNumber,
      dateCode: parentReel.dateCode,
      supplier: parentReel.supplier,
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
  if (!input.skuCode.trim() || !input.mpn.trim() || !input.name.trim()) {
    throw new Error('物料编码、MPN和物料名称不能为空');
  }
  if (state.materials.some((m) => m.skuCode === input.skuCode.trim())) {
    throw new Error(`物料编码已存在: ${input.skuCode}`);
  }
  const next = cloneState(state);
  const material: MaterialSku = {
    ...input,
    skuCode: input.skuCode.trim(),
    mpn: input.mpn.trim(),
    name: input.name.trim(),
  };
  next.materials.push(material);
  return { state: next, material };
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
  for (const mat of state.materials) {
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
    items: input.items.map((item) => ({
      skuCode: item.skuCode,
      qtyPerBoard: Number(item.qtyPerBoard),
      attritionRate: Number.isFinite(item.attritionRate) ? item.attritionRate : 0.02,
      designators: item.designators.trim() || '-',
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


