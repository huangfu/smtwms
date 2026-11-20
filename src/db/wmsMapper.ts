import type {
  AsnOrder,
  BarcodeRule,
  BomMaster,
  Customer,
  CycleCountTask,
  LabelTemplate,
  MaterialSku,
  PackagingSpec,
  ReelItem,
  ScrapRecord,
  Supplier,
  TraceEvent,
  Warehouse,
  WarehouseBin,
  WarehouseKeeper,
  WaveOrder,
  WmsState,
  WorkOrder,
  ZebraPrinterConfig,
} from '../types/wms.ts';

export type WmsSliceKey =
  | 'printerConfig'
  | 'warehouses'
  | 'keepers'
  | 'bins'
  | 'suppliers'
  | 'customers'
  | 'packagingSpecs'
  | 'barcodeRules'
  | 'labelTemplates'
  | 'materials'
  | 'boms'
  | 'asns'
  | 'reels'
  | 'workOrders'
  | 'waves'
  | 'cycleCounts'
  | 'scrapRecords'
  | 'traceEvents';

export const ALL_WMS_SLICE_KEYS: WmsSliceKey[] = [
  'printerConfig',
  'warehouses',
  'keepers',
  'bins',
  'suppliers',
  'customers',
  'packagingSpecs',
  'barcodeRules',
  'labelTemplates',
  'materials',
  'boms',
  'asns',
  'reels',
  'workOrders',
  'waves',
  'cycleCounts',
  'scrapRecords',
  'traceEvents',
];

export function detectChangedSlices(
  prev: WmsState | null,
  next: WmsState
): WmsSliceKey[] {
  if (!prev) return [...ALL_WMS_SLICE_KEYS];
  const changed: WmsSliceKey[] = [];
  for (const key of ALL_WMS_SLICE_KEYS) {
    if (
      prev[key] !== next[key] &&
      JSON.stringify(prev[key] ?? null) !== JSON.stringify(next[key] ?? null)
    ) {
      changed.push(key);
    }
  }
  return changed;
}

export interface RawDbWorkspaceRows {
  printerConfig: ZebraPrinterConfig | null;
  warehouses: Array<Record<string, unknown>>;
  keepers: Array<Record<string, unknown>>;
  bins: Array<Record<string, unknown>>;
  suppliers: Array<Record<string, unknown>>;
  customers: Array<Record<string, unknown>>;
  packagingSpecs: Array<Record<string, unknown>>;
  barcodeRules: Array<Record<string, unknown>>;
  labelTemplates: Array<Record<string, unknown>>;
  materials: Array<Record<string, unknown>>;
  boms: Array<Record<string, unknown>>;
  asns: Array<Record<string, unknown>>;
  reels: Array<Record<string, unknown>>;
  workOrders: Array<Record<string, unknown>>;
  waves: Array<Record<string, unknown>>;
  cycleCounts: Array<Record<string, unknown>>;
  scrapRecords: Array<Record<string, unknown>>;
  traceEvents: Array<Record<string, unknown>>;
}

function optStr(val: unknown): string | undefined {
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

function optNum(val: unknown): number | undefined {
  return typeof val === 'number' && Number.isFinite(val) ? val : undefined;
}

export function mapRowsToPartialWmsState(rows: RawDbWorkspaceRows): Partial<WmsState> {
  return {
    printerConfig: rows.printerConfig ?? undefined,
    warehouses: rows.warehouses.map((r) => ({
      warehouseCode: String(r.warehouseCode),
      warehouseName: String(r.warehouseName),
      warehouseType: String(r.warehouseType),
      managerId: String(r.managerId),
      managerName: String(r.managerName),
      address: String(r.address),
      status: r.status as Warehouse['status'],
      createdAt: String(r.createdAt),
    })),
    keepers: rows.keepers.map((r) => ({
      keeperId: String(r.keeperId),
      employeeNo: String(r.employeeNo),
      name: String(r.name),
      role: r.role as WarehouseKeeper['role'],
      warehouseCode: String(r.warehouseCode),
      phone: String(r.phone),
      shift: r.shift as WarehouseKeeper['shift'],
      status: r.status as WarehouseKeeper['status'],
    })),
    bins: rows.bins.map((r) => ({
      binCode: String(r.binCode),
      warehouseCode: optStr(r.warehouseCode),
      zone: r.zone as WarehouseBin['zone'],
      capacityReels: Number(r.capacityReels),
      keeperName: optStr(r.keeperName),
      description: String(r.description),
    })),
    suppliers: rows.suppliers.map((r) => ({
      supplierCode: String(r.supplierCode),
      supplierName: String(r.supplierName),
      contactName: String(r.contactName),
      phone: String(r.phone),
      categoryTags: String(r.categoryTags),
      qualityGrade: r.qualityGrade as Supplier['qualityGrade'],
      leadTimeDays: Number(r.leadTimeDays),
      notes: optStr(r.notes),
    })),
    customers: rows.customers.map((r) => ({
      customerCode: String(r.customerCode),
      customerName: String(r.customerName),
      contactName: String(r.contactName),
      phone: String(r.phone),
      industry: String(r.industry),
      traceRequirement: String(r.traceRequirement),
      deliveryAddress: String(r.deliveryAddress),
    })),
    packagingSpecs: rows.packagingSpecs.map((r) => ({
      packagingCode: String(r.packagingCode),
      packagingName: String(r.packagingName),
      carrierType: r.carrierType as PackagingSpec['carrierType'],
      reelDiameter: String(r.reelDiameter),
      tapeWidthMm: Number(r.tapeWidthMm),
      pitchMm: Number(r.pitchMm),
      defaultSpq: Number(r.defaultSpq),
      allowSplit: Boolean(r.allowSplit),
      allowMerge: Boolean(r.allowMerge),
      description: String(r.description),
    })),
    barcodeRules: rows.barcodeRules.map((r) => ({
      ruleId: String(r.ruleId),
      ruleName: String(r.ruleName),
      supplierCode: String(r.supplierCode),
      supplierName: String(r.supplierName),
      formatType: r.formatType as BarcodeRule['formatType'],
      delimiter: r.delimiter as BarcodeRule['delimiter'],
      fieldMap: (r.fieldMap ?? {}) as BarcodeRule['fieldMap'],
      sampleBarcode: String(r.sampleBarcode),
      enabled: Boolean(r.enabled),
    })),
    labelTemplates: rows.labelTemplates.map((r) => ({
      templateId: String(r.templateId),
      templateName: String(r.templateName),
      paperSize: r.paperSize as LabelTemplate['paperSize'],
      customWidthMm: optNum(r.customWidthMm),
      customHeightMm: optNum(r.customHeightMm),
      dpi: optNum(r.dpi),
      offsetXMm: optNum(r.offsetXMm),
      offsetYMm: optNum(r.offsetYMm),
      barcodeType: optStr(r.barcodeType) as LabelTemplate['barcodeType'],
      zplMode: optStr(r.zplMode) as LabelTemplate['zplMode'],
      elementOrder: Array.isArray(r.elementOrder)
        ? (r.elementOrder as string[])
        : undefined,
      elementLayouts: Array.isArray(r.elementLayouts)
        ? (r.elementLayouts as LabelTemplate['elementLayouts'])
        : undefined,
      fontScale: optStr(r.fontScale) as LabelTemplate['fontScale'],
      barcodeHeightMm: optNum(r.barcodeHeightMm),
      customZpl: typeof r.customZpl === 'string' ? r.customZpl : undefined,
      headerTitle: String(r.headerTitle),
      footerNote: String(r.footerNote),
      showFields: r.showFields as LabelTemplate['showFields'],
      isDefault: Boolean(r.isDefault),
    })),
    materials: rows.materials.map((r) => ({
      materialKey: optStr(r.materialKey),
      skuCode: String(r.skuCode),
      mpn: String(r.mpn),
      name: String(r.name),
      ownershipType: optStr(r.ownershipType) as MaterialSku['ownershipType'],
      ownerCode: optStr(r.ownerCode),
      ownerName: optStr(r.ownerName),
      customerCode: optStr(r.customerCode),
      customerName: optStr(r.customerName),
      manufacturer: String(r.manufacturer),
      category: r.category as MaterialSku['category'],
      packageType: String(r.packageType),
      packagingCode: optStr(r.packagingCode),
      packagingName: optStr(r.packagingName),
      mpq: optNum(r.mpq),
      supplierCode: optStr(r.supplierCode),
      supplierName: optStr(r.supplierName),
      unit: r.unit as MaterialSku['unit'],
      msdLevel: r.msdLevel as MaterialSku['msdLevel'],
      safetyStock: Number(r.safetyStock),
      defaultBin: String(r.defaultBin),
    })),
    boms: rows.boms.map((r) => ({
      bomId: String(r.bomId),
      productCode: String(r.productCode),
      productName: String(r.productName),
      version: String(r.version),
      customerCode: optStr(r.customerCode),
      customerName: optStr(r.customerName),
      processType: String(r.processType),
      status: r.status as BomMaster['status'],
      items: (Array.isArray(r.items) ? r.items : []) as BomMaster['items'],
      updatedAt: String(r.updatedAt),
    })),
    asns: rows.asns.map((r) => ({
      asnNo: String(r.asnNo),
      poNo: String(r.poNo),
      supplierCode: String(r.supplierCode),
      supplierName: String(r.supplierName),
      warehouseCode: String(r.warehouseCode),
      expectedDate: String(r.expectedDate),
      purchaser: String(r.purchaser),
      source: r.source as AsnOrder['source'],
      status: r.status as AsnOrder['status'],
      notes: optStr(r.notes),
      lines: (Array.isArray(r.lines) ? r.lines : []) as AsnOrder['lines'],
      createdAt: String(r.createdAt),
    })),
    reels: rows.reels.map((r) => ({
      reelId: String(r.reelId),
      parentReelId: optStr(r.parentReelId),
      materialKey: optStr(r.materialKey),
      skuCode: String(r.skuCode),
      mpn: String(r.mpn),
      lotNumber: String(r.lotNumber),
      dateCode: String(r.dateCode),
      supplier: String(r.supplier),
      ownershipType: optStr(r.ownershipType) as ReelItem['ownershipType'],
      ownerCode: optStr(r.ownerCode),
      ownerName: optStr(r.ownerName),
      customerCode: optStr(r.customerCode),
      customerName: optStr(r.customerName),
      packagingCode: optStr(r.packagingCode),
      mpq: optNum(r.mpq),
      receiptDocNo: String(r.receiptDocNo),
      asnNo: optStr(r.asnNo),
      initialQty: Number(r.initialQty),
      qty: Number(r.qty),
      issuedQty: Number(r.issuedQty),
      binCode: String(r.binCode),
      msdLevel: r.msdLevel as ReelItem['msdLevel'],
      msdState: r.msdState as ReelItem['msdState'],
      msdOpenAt: optStr(r.msdOpenAt),
      status: r.status as ReelItem['status'],
      workOrderId: optStr(r.workOrderId),
      receivedAt: String(r.receivedAt),
      updatedAt: String(r.updatedAt),
    })),
    workOrders: rows.workOrders.map((r) => ({
      workOrderId: String(r.workOrderId),
      productCode: String(r.productCode),
      productName: String(r.productName),
      bomId: optStr(r.bomId),
      customerCode: optStr(r.customerCode),
      customerName: optStr(r.customerName),
      lineName: String(r.lineName),
      targetQty: Number(r.targetQty),
      status: r.status as WorkOrder['status'],
      waveId: optStr(r.waveId),
      bom: (Array.isArray(r.bom) ? r.bom : []) as WorkOrder['bom'],
      issuedBySku: (r.issuedBySku ?? {}) as Record<string, number>,
      replenishedBySku: (r.replenishedBySku ?? {}) as Record<string, number>,
      returnedBySku: (r.returnedBySku ?? {}) as Record<string, number>,
      createdAt: String(r.createdAt),
    })),
    waves: rows.waves.map((r) => ({
      waveId: String(r.waveId),
      name: String(r.name),
      workOrderIds: (Array.isArray(r.workOrderIds) ? r.workOrderIds : []) as string[],
      status: r.status as WaveOrder['status'],
      allocations: (Array.isArray(r.allocations) ? r.allocations : []) as WaveOrder['allocations'],
      createdAt: String(r.createdAt),
      completedAt: optStr(r.completedAt),
    })),
    cycleCounts: rows.cycleCounts.map((r) => ({
      countId: String(r.countId),
      title: String(r.title),
      zoneFilter: String(r.zoneFilter),
      status: r.status as CycleCountTask['status'],
      lines: (Array.isArray(r.lines) ? r.lines : []) as CycleCountTask['lines'],
      createdAt: String(r.createdAt),
      completedAt: optStr(r.completedAt),
    })),
    scrapRecords: rows.scrapRecords.map((r) => ({
      scrapId: String(r.scrapId),
      timestamp: String(r.timestamp),
      reelId: String(r.reelId),
      skuCode: String(r.skuCode),
      mpn: String(r.mpn),
      lotNumber: String(r.lotNumber),
      qty: Number(r.qty),
      reason: String(r.reason),
      disposition: String(r.disposition),
      workOrderId: optStr(r.workOrderId),
      operator: String(r.operator),
    })),
    traceEvents: rows.traceEvents.map((r) => ({
      eventId: String(r.eventId),
      timestamp: String(r.timestamp),
      action: r.action as TraceEvent['action'],
      reelId: String(r.reelId),
      skuCode: String(r.skuCode),
      mpn: String(r.mpn),
      lotNumber: String(r.lotNumber),
      dateCode: String(r.dateCode),
      qtyDelta: Number(r.qtyDelta),
      balanceAfter: Number(r.balanceAfter),
      fromBin: optStr(r.fromBin),
      toBin: optStr(r.toBin),
      workOrderId: optStr(r.workOrderId),
      waveId: optStr(r.waveId),
      lineOrStation: optStr(r.lineOrStation),
      docNo: String(r.docNo),
      reason: optStr(r.reason),
      operator: String(r.operator),
    })),
  };
}
