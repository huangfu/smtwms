import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedData } from '../data/seedData';
import {
  addCustomer,
  addMaterialSku,
  addPackagingSpec,
  addSupplier,
  addWarehouse,
  addWarehouseBin,
  addWarehouseKeeper,
  allocateReelsFIFO,
  applyCycleCountReconcile,
  applyInbound,
  applyProductionReturn,
  applyReplenishment,
  applyScrap,
  bakeMsdReel,
  buildMaterialKey,
  computeLowStockAlerts,
  computeSmtAnomalies,
  computeWorkOrderKitting,
  consolidateWaveDemand,
  createAsnOrder,
  createCycleCountTask,
  createWaveOrder,
  deleteBarcodeRule,
  deleteBomMaster,
  deleteCustomer,
  deleteLabelTemplate,
  deleteMaterialSku,
  deletePackagingSpec,
  deleteSupplier,
  deleteWarehouse,
  deleteWarehouseBin,
  deleteWarehouseKeeper,
  importAsnFromCsv,
  issueWaveAllocation,
  normalizeWmsState,
  parseBarcodeString,
  saveBarcodeRule,
  saveBomMaster,
  saveLabelTemplate,
  savePrinterConfig,
  traceByQuery,
  updateCustomer,
  updateMaterialSku,
  updatePackagingSpec,
  updateSupplier,
  updateWarehouse,
  updateWarehouseBin,
  updateWarehouseKeeper,
} from './wmsLogic';
import {
  generatePseudo2dMatrix,
  generateZplFromTemplate,
  mmToDots,
  sanitizeZplText,
} from './zplEngine';

test('parseBarcodeString parses composite IPC-1782 barcodes and plain UIDs', () => {
  const composite = parseBarcodeString('UID:RL261117-888|P:STM32F407VET6|L:ST2645Z|D:2645|Q:1000');
  assert.equal(composite.reelId, 'RL261117-888');
  assert.equal(composite.mpn, 'STM32F407VET6');
  assert.equal(composite.lotNumber, 'ST2645Z');
  assert.equal(composite.dateCode, '2645');
  assert.equal(composite.qty, 1000);

  const plain = parseBarcodeString('RL261015-001');
  assert.equal(plain.reelId, 'RL261015-001');
});

test('inbound creates a new reel with trace event and rejects invalid dateCode', () => {
  const seed = createSeedData();
  const { state, reel, event } = applyInbound(seed, {
    skuCode: 'MAT-IC-001',
    lotNumber: 'ST2646Z1',
    dateCode: '2646',
    supplier: '艾睿电子',
    qty: 500,
    binCode: 'MSD-01-01',
    operator: '测试员',
  });

  assert.equal(state.reels.length, seed.reels.length + 1);
  assert.equal(reel.qty, 500);
  assert.equal(reel.msdState, 'SEALED');
  assert.equal(event.action, 'INBOUND');
  assert.equal(event.qtyDelta, 500);

  assert.throws(() => {
    applyInbound(seed, {
      skuCode: 'MAT-IC-001',
      lotNumber: 'BAD',
      dateCode: '26A',
      supplier: '艾睿电子',
      qty: 100,
      binCode: 'MSD-01-01',
      operator: '测试员',
    });
  }, /DateCode/);
});

test('FIFO allocation skips BAKING_REQUIRED MSD reels and picks older DateCode first', () => {
  const seed = createSeedData();
  const wos = seed.workOrders.filter((w) => w.status === 'PLANNED');
  const demands = consolidateWaveDemand(wos, seed.materials);
  const { allocations } = allocateReelsFIFO(seed.reels, demands);

  // RL261005-011 has dateCode 2634 (oldest) for MAT-IC-001, but is BAKING_REQUIRED!
  // So FIFO allocation MUST skip RL261005-011 and pick RL261015-001 (dateCode 2638).
  const icAlloc = allocations.find((a) => a.skuCode === 'MAT-IC-001');
  assert.ok(icAlloc);
  assert.equal(icAlloc.reelId, 'RL261015-001');

  // After baking RL261005-011, it becomes SEALED and eligible again
  const { state: bakedState } = bakeMsdReel(seed, {
    reelId: 'RL261005-011',
    operator: 'IQC烘烤员',
  });
  const bakedReel = bakedState.reels.find((r) => r.reelId === 'RL261005-011')!;
  assert.equal(bakedReel.msdState, 'SEALED');
  assert.equal(bakedState.traceEvents[0].action, 'MSD_BAKE');
});

test('FIFO violation guard blocks scanning newer reel when older allocated reel is pending', () => {
  const seed = createSeedData();
  const { state: s1, wave } = createWaveOrder(seed, {
    name: 'FIFO Guard Wave',
    workOrderIds: ['WO-20261117-01'],
    operator: '测试员',
  });

  // RL261012-004 (2636) is allocated; try scanning RL261105-005 (2643) instead
  assert.throws(() => {
    issueWaveAllocation(s1, {
      waveId: wave.waveId,
      reelId: 'RL261105-005',
      operator: '发料员',
    });
  }, /FIFO防错拦截/);
});

test('work order kitting check computes accurate readiness', () => {
  const seed = createSeedData();
  const wo = seed.workOrders.find((w) => w.workOrderId === 'WO-20261117-01')!;
  const kitting = computeWorkOrderKitting(wo, seed.reels, seed.materials);
  assert.equal(kitting.isFullyKitted, true);
  assert.equal(kitting.readinessPercent, 100);
});

test('end-to-end flow: wave -> issue -> replenish -> split return -> scrap -> trace', () => {
  const seed = createSeedData();
  const { state: s1, wave } = createWaveOrder(seed, {
    name: 'Test Wave',
    workOrderIds: ['WO-20261117-01'],
    operator: '测试员',
  });

  const targetAlloc = wave.allocations.find((a) => a.skuCode === 'MAT-RES-001');
  assert.ok(targetAlloc);

  // Wave issue
  const { state: s2 } = issueWaveAllocation(s1, {
    waveId: wave.waveId,
    reelId: targetAlloc.reelId,
    operator: '发料员',
  });
  const issuedReel = s2.reels.find((r) => r.reelId === targetAlloc.reelId)!;
  assert.equal(issuedReel.qty, 10000 - targetAlloc.requiredQty);
  assert.equal(issuedReel.status, 'ISSUED_TO_LINE');

  // Production Replenishment (+200 pcs attrition)
  const { state: s3 } = applyReplenishment(s2, {
    workOrderId: 'WO-20261117-01',
    reelId: targetAlloc.reelId,
    qty: 200,
    reason: 'SMT飞达抛料',
    station: 'SMT-Line-01 Feeder#12',
    operator: '物料员',
  });
  const repReel = s3.reels.find((r) => r.reelId === targetAlloc.reelId)!;
  assert.equal(repReel.qty, 10000 - targetAlloc.requiredQty - 200);

  // Split Return (+500 pcs into child sub-reel)
  const { state: s4, reel: childReel } = applyProductionReturn(s3, {
    workOrderId: 'WO-20261117-01',
    reelId: targetAlloc.reelId,
    returnQty: 500,
    toBin: 'A-01-01',
    reason: '工单换线余料分拆退库',
    operator: '物料员',
    splitChildReel: true,
  });
  assert.equal(childReel.parentReelId, targetAlloc.reelId);
  assert.equal(childReel.status, 'IN_STOCK');
  assert.equal(childReel.qty, 500);

  // Scrap 100 pcs on child reel
  const { state: s5 } = applyScrap(s4, {
    reelId: childReel.reelId,
    qty: 100,
    reason: '料带折损',
    disposition: '销毁',
    operator: 'QE',
  });
  const scrReel = s5.reels.find((r) => r.reelId === childReel.reelId)!;
  assert.equal(scrReel.qty, 400);

  // Traceability lookup by parent reel ID finds parent & child events
  const trace = traceByQuery(s5, targetAlloc.reelId);
  const actions = trace.events.map((e) => e.action);
  assert.ok(actions.includes('WAVE_ALLOCATE'));
  assert.ok(actions.includes('WAVE_ISSUE'));
  assert.ok(actions.includes('REPLENISH'));
  assert.ok(actions.includes('RETURN'));
  assert.ok(actions.includes('SCRAP'));
});

test('cycle count reconciles inventory variance and records trace event', () => {
  const seed = createSeedData();
  const { state: s1, task } = createCycleCountTask(seed, {
    title: '全仓抽盘',
    zoneFilter: '防潮恒温柜(MSD)',
  });

  const counts: Record<string, number> = {};
  for (const line of task.lines) {
    counts[line.reelId] = line.reelId === 'RL261015-001' ? 985 : line.bookQty;
  }

  const { state: s2, task: completed } = applyCycleCountReconcile(s1, {
    countId: task.countId,
    counts,
    operator: '盘点员',
  });

  assert.equal(completed.status, 'COMPLETED');
  const adjustedReel = s2.reels.find((r) => r.reelId === 'RL261015-001')!;
  assert.equal(adjustedReel.qty, 985);
  assert.equal(s2.traceEvents[0].action, 'CYCLE_COUNT');
  assert.equal(s2.traceEvents[0].qtyDelta, -15);
});

test('computeSmtAnomalies detects WO shortages, MSD floor-life critical thresholds, and abnormal inventory levels', () => {
  const seed = createSeedData();
  const report = computeSmtAnomalies(seed, new Date());

  // Shortages: MAT-CON-001 (need 1173, avail 1000 => short 173) & MAT-PCB-001 (need 505, avail 500 => short 5)
  const conShort = report.shortages.find((s) => s.skuCode === 'MAT-CON-001');
  assert.ok(conShort);
  assert.equal(conShort.shortageQty, 173);
  assert.equal(conShort.severity, 'CRITICAL');

  // MSD alerts: RL261005-011 (EXPIRED_LOCKED) & RL261111-012 (CRITICAL_THRESHOLD ~12h remaining)
  const expiredMsd = report.msdAlerts.find((m) => m.reelId === 'RL261005-011');
  const nearMsd = report.msdAlerts.find((m) => m.reelId === 'RL261111-012');
  assert.ok(expiredMsd);
  assert.equal(expiredMsd.status, 'EXPIRED_LOCKED');
  assert.equal(expiredMsd.severity, 'CRITICAL');
  assert.ok(nearMsd);
  assert.equal(nearMsd.status, 'CRITICAL_THRESHOLD');
  assert.equal(nearMsd.severity, 'WARNING');
  assert.ok(nearMsd.remainingHours > 0 && nearMsd.remainingHours <= 24);

  // Inventory levels: MAT-PCB-001 (500 < 600 LOW_STOCK) + stagnant aging reels > 30 days
  const lowPcb = report.inventoryLevels.find(
    (l) => l.skuCode === 'MAT-PCB-001' && l.anomalyType === 'LOW_STOCK'
  );
  assert.ok(lowPcb);
  assert.equal(lowPcb.currentQty, 500);
  assert.equal(lowPcb.thresholdQty, 600);
});

test('master data CRUD: warehouse, bin, keeper, supplier, customer, and BOM master', () => {
  const seed = createSeedData();
  const { state: s1, keeper } = addWarehouseKeeper(seed, {
    employeeNo: 'EMP-201',
    name: '周敏',
    role: '收料仓管员',
    warehouseCode: 'WH-SMT-01',
    phone: '139-0000-1111',
    shift: '白班',
  });
  assert.equal(keeper.employeeNo, 'EMP-201');

  const { state: s2, warehouse } = addWarehouse(s1, {
    warehouseCode: 'WH-SMT-02',
    warehouseName: 'SMT二厂成品及辅料仓',
    warehouseType: '恒温电子仓',
    managerId: keeper.keeperId,
    address: 'B栋1楼',
  });
  assert.equal(warehouse.managerName, '周敏');

  const { state: s3, bin } = addWarehouseBin(s2, {
    binCode: 'C-03-01',
    warehouseCode: 'WH-SMT-02',
    zone: '电子料主库区',
    capacityReels: 32,
    description: '二厂新货架C3',
  });
  assert.equal(bin.keeperName, '周敏');

  const { state: s4, supplier } = addSupplier(s3, {
    supplierCode: 'SUP-MOUSER',
    supplierName: '贸泽电子(Mouser)',
    contactName: '李经理',
    phone: '400-888-9999',
    categoryTags: 'IC芯片/连接器',
    qualityGrade: 'A级免检',
    leadTimeDays: 5,
  });
  assert.equal(supplier.supplierCode, 'SUP-MOUSER');

  const { state: s5, customer } = addCustomer(s4, {
    customerCode: 'CUS-BYD',
    customerName: '比亚迪汽车电子',
    contactName: '张工',
    phone: '0755-8988-8888',
    industry: '车规级PCBA',
    traceRequirement: 'IATF16949全程UID+DateCode追溯',
    deliveryAddress: '深圳坪山工业园',
  });
  assert.equal(customer.customerCode, 'CUS-BYD');

  const { state: s6, bom } = saveBomMaster(s5, {
    productCode: 'PCBA-BMS-01',
    productName: '车规BMS采样控制板',
    version: 'V2.1',
    customerCode: 'CUS-BYD',
    processType: '双面SMT + 三防涂覆',
    items: [
      { skuCode: 'MAT-IC-001', qtyPerBoard: 1, attritionRate: 0.01, designators: 'U1' },
      { skuCode: 'MAT-RES-001', qtyPerBoard: 6, attritionRate: 0.05, designators: 'R1-R6' },
    ],
  });
  assert.equal(bom.customerName, '比亚迪汽车电子');
  assert.equal(bom.items.length, 2);
});

test('ASN manual creation, procurement CSV import, and ASN-linked inbound receiving progression', () => {
  const seed = createSeedData();

  // Manual ASN
  const { state: s1, asn: manualAsn } = createAsnOrder(seed, {
    poNo: 'PO-20261117-99',
    supplierCode: 'SUP-ARROW',
    warehouseCode: 'WH-MSD-01',
    expectedDate: '2026-11-18',
    purchaser: '王采购',
    lines: [{ skuCode: 'MAT-IC-001', expectedQty: 500, lotNumber: 'ST2646X1', dateCode: '2646' }],
  });
  assert.equal(manualAsn.status, 'PENDING');
  assert.equal(manualAsn.source, 'MANUAL');

  // Procurement CSV import
  const csv = [
    'PO号,供应商,预计到货日,SKU/MPN,数量,批次Lot,周期DateCode,建议库位',
    'PO-20261117-88,深南电路,2026-11-18,PCB-CTRL-V3-4L,400,SCC2646Z9,2646,P-01-01',
    'PO-20261117-88,深南电路,2026-11-18,MAT-CON-001,300,JS2646Z1,2646,B-02-01',
  ].join('\n');

  const { state: s2, asn: csvAsn } = importAsnFromCsv(s1, {
    csvText: csv,
    warehouseCode: 'WH-COLD-01',
    purchaser: '采购导入',
  });
  assert.equal(csvAsn.source, 'UPLOAD_CSV');
  assert.equal(csvAsn.lines.length, 2);
  assert.equal(csvAsn.lines[0].mpn, 'PCB-CTRL-V3-4L');

  // Partial inbound against csvAsn line 1 (200 of 400) -> PARTIAL
  const { state: s3, reel: r1 } = applyInbound(s2, {
    skuCode: 'MAT-PCB-001',
    lotNumber: 'SCC2646Z9',
    dateCode: '2646',
    supplier: csvAsn.supplierName,
    qty: 200,
    binCode: 'P-01-01',
    asnNo: csvAsn.asnNo,
    asnLineId: csvAsn.lines[0].lineId,
    operator: '张伟',
  });
  assert.equal(r1.asnNo, csvAsn.asnNo);
  const partialAsn = s3.asns.find((a) => a.asnNo === csvAsn.asnNo)!;
  assert.equal(partialAsn.status, 'PARTIAL');
  assert.equal(partialAsn.lines[0].receivedQty, 200);

  // Receive remaining 200 on line 1 and 300 on line 2 -> COMPLETED
  const { state: s4 } = applyInbound(s3, {
    skuCode: 'MAT-PCB-001',
    lotNumber: 'SCC2646Z9',
    dateCode: '2646',
    supplier: csvAsn.supplierName,
    qty: 200,
    binCode: 'P-01-01',
    asnNo: csvAsn.asnNo,
    asnLineId: csvAsn.lines[0].lineId,
    operator: '张伟',
  });
  const { state: s5 } = applyInbound(s4, {
    skuCode: 'MAT-CON-001',
    lotNumber: 'JS2646Z1',
    dateCode: '2646',
    supplier: csvAsn.supplierName,
    qty: 300,
    binCode: 'B-02-01',
    asnNo: csvAsn.asnNo,
    asnLineId: csvAsn.lines[1].lineId,
    operator: '张伟',
  });
  const completedAsn = s5.asns.find((a) => a.asnNo === csvAsn.asnNo)!;
  assert.equal(completedAsn.status, 'COMPLETED');
});

test('normalizeWmsState backfills missing master data arrays on legacy store payloads', () => {
  const seed = createSeedData();
  const legacyPartial = {
    materials: seed.materials,
    bins: seed.bins.map(({ binCode, zone, capacityReels, description }) => ({
      binCode,
      zone,
      capacityReels,
      description,
    })),
    reels: seed.reels,
    workOrders: seed.workOrders,
    waves: [],
    cycleCounts: [],
    scrapRecords: [],
    traceEvents: [],
  };
  const hydrated = normalizeWmsState(legacyPartial, seed);
  assert.equal(hydrated.warehouses.length, seed.warehouses.length);
  assert.equal(hydrated.asns.length, seed.asns.length);
  assert.equal(hydrated.bins[0].warehouseCode, 'WH-SMT-01');
});

test('computeLowStockAlerts detects materials below safetyStock, tracks pending ASNs, and clears on replenishment', () => {
  const seed = createSeedData();
  const alerts = computeLowStockAlerts(seed);

  // Seed should surface MAT-PAS-001 (4/10 CRITICAL), MAT-PCB-001 (500/600 WARNING), MAT-CON-001 (1000/1200 WARNING)
  assert.equal(alerts.length, 3);
  assert.equal(alerts[0].skuCode, 'MAT-PAS-001');
  assert.equal(alerts[0].severity, 'CRITICAL');
  assert.equal(alerts[0].deficitQty, 6);
  assert.equal(alerts[0].coveragePct, 40);

  const pcbAlert = alerts.find((a) => a.skuCode === 'MAT-PCB-001');
  assert.ok(pcbAlert);
  assert.equal(pcbAlert.pendingAsnQty, 300);
  assert.ok(pcbAlert.pendingAsnNos.includes('ASN-20261117-02'));

  // Replenishing MAT-PAS-001 by deficit (6 bottles) clears its low-stock alert
  const { state: replenished } = applyInbound(seed, {
    skuCode: 'MAT-PAS-001',
    lotNumber: 'SJ2646Q1',
    dateCode: '2646',
    supplier: '千住金属深圳',
    qty: 6,
    binCode: 'COLD-01-01',
    operator: '张伟',
  });
  const afterAlerts = computeLowStockAlerts(replenished);
  assert.equal(afterAlerts.some((a) => a.skuCode === 'MAT-PAS-001'), false);
  assert.equal(afterAlerts.length, 2);
});

test('material catalog enforces composite (skuCode + ownershipType + ownerCode) key uniqueness', () => {
  const seed = createSeedData();

  // Adding the exact same SKU under a different customer ownership MUST succeed
  const { state: s1, material: hwMat } = addMaterialSku(seed, {
    skuCode: 'MAT-IC-001',
    mpn: 'STM32F407VET6',
    name: 'ARM Cortex-M4 32位MCU (华为客供专料)',
    ownershipType: 'CUSTOMER_CONSIGNED',
    ownerCode: 'CUS-HWDE',
    manufacturer: 'STMicroelectronics',
    category: 'IC芯片',
    packageType: 'LQFP-100',
    packagingCode: 'PKG-TRAY-JEDEC',
    supplierCode: 'SUP-ARROW',
    unit: 'PCS',
    msdLevel: 'Level 3',
    safetyStock: 0,
    defaultBin: 'MSD-01-01',
  });
  assert.equal(hwMat.materialKey, buildMaterialKey('MAT-IC-001', 'CUSTOMER_CONSIGNED', 'CUS-HWDE'));
  assert.equal(hwMat.ownerName, '华为数字能源配套');
  assert.equal(hwMat.mpq, 1000);

  // Adding duplicate (MAT-IC-001 + CUSTOMER_CONSIGNED + CUS-HWDE) MUST fail
  assert.throws(() => {
    addMaterialSku(s1, {
      skuCode: 'MAT-IC-001',
      mpn: 'STM32F407VET6',
      name: '重复客供料',
      ownershipType: 'CUSTOMER_CONSIGNED',
      ownerCode: 'CUS-HWDE',
      manufacturer: 'ST',
      category: 'IC芯片',
      packageType: 'LQFP-100',
      unit: 'PCS',
      msdLevel: 'Level 3',
      safetyStock: 0,
      defaultBin: 'MSD-01-01',
    });
  }, /同一料号与业务归属组合已存在/);
});

test('packaging SPQ master and supplier barcode rules / label templates work end-to-end', () => {
  const seed = createSeedData();
  const { state: s1, spec } = addPackagingSpec(seed, {
    packagingCode: 'PKG-REEL-7-12',
    packagingName: '7寸卷盘 · 12mm载带 (2000/盘)',
    carrierType: 'REEL',
    reelDiameter: '7寸 (178mm)',
    tapeWidthMm: 12,
    pitchMm: 8,
    defaultSpq: 2000,
    allowSplit: true,
    allowMerge: false,
    description: '连接器/大电阻12mm载带',
  });
  assert.equal(spec.defaultSpq, 2000);

  // Parse Arrow DELIMITED_ORDER barcode rule
  const arrowParsed = parseBarcodeString(
    'STM32F407VET6;ST2646A9;2646;1000;RL-ARROW-088',
    s1.barcodeRules,
    'SUP-ARROW'
  );
  assert.equal(arrowParsed.matchedRuleId, 'RULE-ARROW-SEQ');
  assert.equal(arrowParsed.mpn, 'STM32F407VET6');
  assert.equal(arrowParsed.lotNumber, 'ST2646A9');
  assert.equal(arrowParsed.dateCode, '2646');
  assert.equal(arrowParsed.qty, 1000);
  assert.equal(arrowParsed.reelId, 'RL-ARROW-088');

  // Parse Yageo custom KEY_VALUE barcode rule
  const yageoParsed = parseBarcodeString(
    'PN:RC0402FR-0710KL;LN:YG2646V1;DC:2646;QTY:10000',
    s1.barcodeRules,
    'SUP-YAGEO'
  );
  assert.equal(yageoParsed.matchedRuleId, 'RULE-YAGEO-KV');
  assert.equal(yageoParsed.mpn, 'RC0402FR-0710KL');
  assert.equal(yageoParsed.lotNumber, 'YG2646V1');
  assert.equal(yageoParsed.qty, 10000);

  // Save custom barcode rule & label template
  const { state: s2, rule } = saveBarcodeRule(s1, {
    ruleName: 'JST 逗号五段码',
    supplierCode: 'SUP-JST',
    formatType: 'DELIMITED_ORDER',
    delimiter: ',',
    fieldMap: { mpnKey: '0', lotKey: '1', dateCodeKey: '2', qtyKey: '3' },
    sampleBarcode: 'BM04B-GHS-TBT,JS2646L1,2646,1000',
    enabled: true,
  });
  assert.equal(rule.supplierName, 'JST华南总代');

  const { state: s3, template } = saveLabelTemplate(s2, {
    templateName: '产线加急防呆标 (50×30mm)',
    paperSize: '50x30mm',
    headerTitle: '加急产线直发标签',
    footerNote: '优先上机',
    showFields: {
      mpn: true,
      skuCode: true,
      ownership: true,
      packagingMpq: true,
      supplier: true,
      lotDateCode: true,
      binMsd: true,
      compositeBarcode: true,
    },
    isDefault: true,
  });
  assert.equal(template.isDefault, true);
  assert.equal(s3.labelTemplates.filter((t) => t.isDefault).length, 1);
});

test('single-table BOM supports SPECIAL_MAIN and SUBSTITUTE rows without double-counting demand', () => {
  const seed = createSeedData();
  const { state: s1, bom } = saveBomMaster(seed, {
    productCode: 'PCBA-DRIVE-X1',
    productName: '伺服驱动主控板 X1',
    version: 'V1.0',
    customerCode: 'CUS-INOV',
    processType: '双面SMT + 回流焊',
    items: [
      {
        skuCode: 'MAT-IC-SPEC1',
        qtyPerBoard: 1,
        attritionRate: 0.01,
        designators: 'U5',
        itemRole: 'SPECIAL_MAIN',
        remark: 'X1机型独占以太网PHY特料',
      },
      {
        skuCode: 'MAT-RES-001',
        qtyPerBoard: 10,
        attritionRate: 0.05,
        designators: 'R1-R10',
        itemRole: 'MAIN',
      },
      {
        skuCode: 'MAT-RES-ALT1',
        qtyPerBoard: 10,
        attritionRate: 0.05,
        designators: 'R1-R10',
        itemRole: 'SUBSTITUTE',
        substituteForSku: 'MAT-RES-001',
        substitutePriority: 1,
        substituteRatio: 1,
        remark: 'VMI 5%电阻代用',
      },
    ],
  });

  assert.equal(bom.items.length, 3);
  assert.equal(bom.items[0].itemRole, 'SPECIAL_MAIN');
  assert.equal(bom.items[2].itemRole, 'SUBSTITUTE');
  assert.equal(bom.items[2].substituteForSku, 'MAT-RES-001');

  // Consolidate wave demand must NOT double-count MAT-RES-ALT1 (SUBSTITUTE row)
  const demands = consolidateWaveDemand(
    [
      {
        workOrderId: 'WO-TEST-SUB',
        productCode: bom.productCode,
        productName: bom.productName,
        bomId: bom.bomId,
        lineName: 'SMT-Line-01',
        targetQty: 100,
        status: 'PLANNED',
        bom: bom.items,
        issuedBySku: {},
        replenishedBySku: {},
        returnedBySku: {},
        createdAt: new Date().toISOString(),
      },
    ],
    s1.materials
  );
  assert.equal(demands.some((d) => d.skuCode === 'MAT-RES-ALT1'), false);
  assert.equal(demands.find((d) => d.skuCode === 'MAT-RES-001')?.requiredQty, 1050);
});

test('material SKU defaults to MPN when omitted and allows unrestricted custom override', () => {
  const seed = createSeedData();

  // Omit skuCode -> auto uses MPN (trimmed & uppercased)
  const { state: s1, material: autoMat } = addMaterialSku(seed, {
    skuCode: '',
    mpn: 'tps5430ddarg4',
    name: 'TI 降压电源转换芯片',
    ownershipType: 'SELF_PURCHASED',
    ownerCode: 'INTERNAL',
    manufacturer: 'Texas Instruments',
    category: 'IC芯片',
    packageType: 'SOIC-8',
    packagingCode: 'PKG-REEL-7-12',
    supplierCode: 'SUP-ARROW',
    unit: 'PCS',
    msdLevel: 'Level 2',
    safetyStock: 200,
    defaultBin: 'MSD-01-01',
  });
  assert.equal(autoMat.skuCode, 'TPS5430DDARG4');
  assert.equal(autoMat.mpn, 'tps5430ddarg4');
  assert.equal(autoMat.customerName, '通用共享 (不限客户)');

  // Unrestricted custom internal SKU (supports arbitrary characters/formats)
  const { state: s2, material: customMat } = addMaterialSku(s1, {
    skuCode: 'INNER.IC/2026-099',
    mpn: 'LTC3891EMSE',
    name: 'Linear 同步降压控制器',
    ownershipType: 'SELF_PURCHASED',
    ownerCode: 'INTERNAL',
    customerCode: 'CUS-DJI',
    manufacturer: 'ADI',
    category: 'IC芯片',
    packageType: 'MSOP-20',
    unit: 'PCS',
    msdLevel: 'Level 1',
    safetyStock: 100,
    defaultBin: 'A-01-01',
  });
  assert.equal(customMat.skuCode, 'INNER.IC/2026-099');
  assert.equal(customMat.customerCode, 'CUS-DJI');
  assert.equal(customMat.customerName, '大疆行业应用制造');
  assert.equal(
    customMat.materialKey,
    buildMaterialKey('INNER.IC/2026-099', 'SELF_PURCHASED', 'INTERNAL', 'CUS-DJI')
  );

  // Clean up unreferenced custom material
  const { state: s3 } = deleteMaterialSku(s2, customMat.materialKey!);
  assert.equal(s3.materials.some((m) => m.materialKey === customMat.materialKey), false);
});

test('non-consigned material customer scoping prioritizes dedicated stock and blocks cross-customer wave/replenishment', () => {
  const seed = createSeedData();

  // Add a SELF_PURCHASED material specifically designated for CUS-INOV (汇川技术) with same SKU MAT-IC-001
  const { state: s1, material: inovSelfMat } = addMaterialSku(seed, {
    skuCode: 'MAT-IC-001',
    mpn: 'STM32F407VET6',
    name: 'ARM Cortex-M4 (自购汇川专备)',
    ownershipType: 'SELF_PURCHASED',
    ownerCode: 'INTERNAL',
    customerCode: 'CUS-INOV',
    manufacturer: 'STMicroelectronics',
    category: 'IC芯片',
    packageType: 'LQFP-100',
    packagingCode: 'PKG-TRAY-JEDEC',
    supplierCode: 'SUP-ARROW',
    unit: 'PCS',
    msdLevel: 'Level 3',
    safetyStock: 0,
    defaultBin: 'MSD-01-01',
  });

  // Inbound a reel dedicated to CUS-INOV with newer dateCode 2645
  const { state: s2, reel: inovReel } = applyInbound(s1, {
    materialKey: inovSelfMat.materialKey,
    skuCode: 'MAT-IC-001',
    lotNumber: 'INOV2645',
    dateCode: '2645',
    supplier: '艾睿电子',
    qty: 500,
    binCode: 'MSD-01-01',
    operator: '收料员',
  });
  assert.equal(inovReel.ownershipType, 'SELF_PURCHASED');
  assert.equal(inovReel.customerCode, 'CUS-INOV');

  // Create a planned WO for CUS-INOV needing 100 pcs of MAT-IC-001
  const inovWo = {
    workOrderId: 'WO-INOV-DED-01',
    productCode: 'PCBA-INOV-TEST',
    productName: '汇川专备测试板',
    customerCode: 'CUS-INOV',
    customerName: '汇川技术自动化',
    lineName: 'SMT-Line-02',
    targetQty: 100,
    status: 'PLANNED' as const,
    bom: [{ skuCode: 'MAT-IC-001', qtyPerBoard: 1, attritionRate: 0, designators: 'U1' }],
    issuedBySku: {},
    replenishedBySku: {},
    returnedBySku: {},
    createdAt: new Date().toISOString(),
  };
  const s3 = { ...s2, workOrders: [inovWo, ...s2.workOrders] };

  // FIFO allocation for CUS-INOV MUST prioritize CUS-INOV dedicated reel even though COMMON reel RL261015-001 has older dateCode 2638
  const inovDemands = consolidateWaveDemand([inovWo], s3.materials);
  const { allocations: inovAlloc } = allocateReelsFIFO(s3.reels, inovDemands);
  assert.equal(inovAlloc[0]?.reelId, inovReel.reelId);

  // Cross-customer isolation: CUS-HWDE work order MUST NOT receive CUS-INOV dedicated reel
  const hwdeWo = s3.workOrders.find((w) => w.workOrderId === 'WO-20261117-02')!;
  assert.equal(hwdeWo.customerCode, 'CUS-HWDE');
  const hwdeDemands = consolidateWaveDemand([hwdeWo], s3.materials);
  const { allocations: hwdeAlloc } = allocateReelsFIFO(s3.reels, hwdeDemands);
  assert.equal(hwdeAlloc.some((a) => a.reelId === inovReel.reelId), false);

  // Replenishing CUS-INOV dedicated reel onto CUS-HWDE WO must be blocked
  assert.throws(() => {
    applyReplenishment(s3, {
      workOrderId: 'WO-20261117-02',
      reelId: inovReel.reelId,
      qty: 10,
      reason: '产线误扫跨客户专备料',
      station: 'SMT-Line-02',
      operator: '物料员',
    });
  }, /客户归属防错拦截/);

  // Add a dedicated CUS-INOV resistor reel and ensure CUS-HWDE wave blocks scanning it
  const { state: s3b, material: inovResMat } = addMaterialSku(s3, {
    skuCode: 'MAT-RES-001',
    mpn: 'RC0402FR-0710KL',
    name: '贴片电阻 (汇川专备)',
    ownershipType: 'SELF_PURCHASED',
    ownerCode: 'INTERNAL',
    customerCode: 'CUS-INOV',
    manufacturer: 'YAGEO',
    category: '阻容感',
    packageType: '0402',
    packagingCode: 'PKG-REEL-7-10K',
    supplierCode: 'SUP-YAGEO',
    unit: 'PCS',
    msdLevel: 'Level 1',
    safetyStock: 0,
    defaultBin: 'A-01-01',
  });
  const { state: s3c, reel: inovResReel } = applyInbound(s3b, {
    materialKey: inovResMat.materialKey,
    skuCode: 'MAT-RES-001',
    lotNumber: 'YG-INOV-01',
    dateCode: '2646',
    supplier: '国巨原厂直供',
    qty: 5000,
    binCode: 'A-01-01',
    operator: '收料员',
  });
  const { state: s4, wave: hwdeWave } = createWaveOrder(s3c, {
    name: '华为波次',
    workOrderIds: ['WO-20261117-02'],
    operator: '仓管员',
  });
  assert.throws(() => {
    issueWaveAllocation(s4, {
      waveId: hwdeWave.waveId,
      reelId: inovResReel.reelId,
      operator: '发料员',
    });
  }, /客户业务归属防错拦截/);
});

test('all master data modules support update and delete with referential integrity guards', () => {
  const seed = createSeedData();

  // 1. Material update (change unique SKU code + custom customer) & active-reel delete guard
  const capMat = seed.materials.find((m) => m.skuCode === 'MAT-CAP-001')!;
  const { state: m1, material: updatedMat } = updateMaterialSku(seed, capMat.materialKey!, {
    ...capMat,
    skuCode: 'GRM155-CAP-NEW',
    name: '贴片陶瓷电容 100nF (修订)',
    customerCode: 'CUS-DJI',
  });
  assert.equal(updatedMat.skuCode, 'GRM155-CAP-NEW');
  assert.equal(updatedMat.customerCode, 'CUS-DJI');
  // Linked reel & BOM cascaded SKU rename
  assert.equal(m1.reels.some((r) => r.skuCode === 'GRM155-CAP-NEW'), true);
  assert.equal(m1.boms.some((b) => b.items.some((i) => i.skuCode === 'GRM155-CAP-NEW')), true);
  // Deleting material with active reels is blocked
  assert.throws(() => deleteMaterialSku(m1, updatedMat.materialKey!), /尚有 .* 盘在库或线边库存/);

  // 2. Packaging update & delete guard
  const { state: p1, spec: updPkg } = updatePackagingSpec(m1, 'PKG-REEL-7-8', {
    ...m1.packagingSpecs.find((p) => p.packagingCode === 'PKG-REEL-7-8')!,
    packagingName: '7寸卷盘 · 8mm载带 (更新)',
    defaultSpq: 5000,
  });
  assert.equal(updPkg.packagingName, '7寸卷盘 · 8mm载带 (更新)');
  assert.throws(() => deletePackagingSpec(p1, 'PKG-REEL-7-8'), /正被 .* 条物料档案引用/);

  const { state: p2 } = addPackagingSpec(p1, {
    packagingCode: 'PKG-TEMP-01',
    packagingName: '临时测试包装',
    carrierType: 'BULK',
    reelDiameter: '-',
    tapeWidthMm: 0,
    pitchMm: 0,
    defaultSpq: 100,
    allowSplit: true,
    allowMerge: true,
    description: 'temp',
  });
  const { state: p3 } = deletePackagingSpec(p2, 'PKG-TEMP-01');
  assert.equal(p3.packagingSpecs.some((p) => p.packagingCode === 'PKG-TEMP-01'), false);

  // 3. Barcode rule & label template delete
  const { state: b1, rule: tempRule } = saveBarcodeRule(p3, {
    ruleName: '临时规则',
    supplierCode: 'ALL',
    formatType: 'KEY_VALUE',
    delimiter: '|',
    fieldMap: { mpnKey: 'P', lotKey: 'L', dateCodeKey: 'D', qtyKey: 'Q' },
    sampleBarcode: 'P:X|L:1|D:2645|Q:10',
    enabled: true,
  });
  const { state: b2 } = deleteBarcodeRule(b1, tempRule.ruleId);
  assert.equal(b2.barcodeRules.some((r) => r.ruleId === tempRule.ruleId), false);

  const { state: t1, template: tempTpl } = saveLabelTemplate(b2, {
    templateName: '临时模板',
    paperSize: '50x30mm',
    headerTitle: '临时标',
    footerNote: '备注',
    showFields: {
      mpn: true,
      skuCode: true,
      ownership: true,
      packagingMpq: true,
      supplier: true,
      lotDateCode: true,
      binMsd: true,
      compositeBarcode: true,
    },
    isDefault: false,
  });
  const { state: t2 } = deleteLabelTemplate(t1, tempTpl.templateId);
  assert.equal(t2.labelTemplates.some((t) => t.templateId === tempTpl.templateId), false);

  // 4. Warehouse, Bin, Keeper update & delete guards
  const { state: w1 } = addWarehouse(t2, {
    warehouseCode: 'WH-TEMP',
    warehouseName: '临时扩展仓',
    warehouseType: '辅料仓',
    managerId: t2.keepers[0].keeperId,
    address: 'C栋',
  });
  const { state: w2, warehouse: updWh } = updateWarehouse(w1, 'WH-TEMP', {
    warehouseName: '临时扩展仓(已更名)',
    warehouseType: '恒温仓',
    managerId: w1.keepers[0].keeperId,
    address: 'C栋2F',
    status: 'INACTIVE',
  });
  assert.equal(updWh.warehouseName, '临时扩展仓(已更名)');
  assert.equal(updWh.status, 'INACTIVE');

  const { state: w3 } = addWarehouseBin(w2, {
    binCode: 'TEMP-01-01',
    warehouseCode: 'WH-TEMP',
    zone: '电子料主库区',
    capacityReels: 10,
    description: 'temp bin',
  });
  const { state: w4, bin: updBin } = updateWarehouseBin(w3, 'TEMP-01-01', {
    warehouseCode: 'WH-TEMP',
    zone: 'PCB板库区',
    capacityReels: 25,
    description: 'updated bin',
  });
  assert.equal(updBin.capacityReels, 25);
  // Cannot delete warehouse while it still has bins
  assert.throws(() => deleteWarehouse(w4, 'WH-TEMP'), /仍有 .* 个库位/);
  const { state: w5 } = deleteWarehouseBin(w4, 'TEMP-01-01');
  const { state: w6 } = deleteWarehouse(w5, 'WH-TEMP');
  assert.equal(w6.warehouses.some((w) => w.warehouseCode === 'WH-TEMP'), false);

  const { state: k1, keeper: tempKeeper } = addWarehouseKeeper(w6, {
    employeeNo: 'EMP-999',
    name: '赵六',
    role: 'IQC/MSD专员',
    warehouseCode: 'WH-SMT-01',
    phone: '13800009999',
    shift: '夜班',
  });
  const { state: k2, keeper: updKeeper } = updateWarehouseKeeper(k1, tempKeeper.keeperId, {
    employeeNo: 'EMP-999',
    name: '赵六(组长)',
    role: '仓库主管',
    warehouseCode: 'WH-SMT-01',
    phone: '13800008888',
    shift: '常白班',
    status: 'ACTIVE',
  });
  assert.equal(updKeeper.name, '赵六(组长)');
  // Primary manager of WH-SMT-01 cannot be deleted
  assert.throws(() => deleteWarehouseKeeper(k2, k2.warehouses[0].managerId), /主负责人/);
  const { state: k3 } = deleteWarehouseKeeper(k2, tempKeeper.keeperId);
  assert.equal(k3.keepers.some((k) => k.keeperId === tempKeeper.keeperId), false);

  // 5. Supplier & Customer update & delete guards
  const { state: sc1, supplier: tempSup } = addSupplier(k3, {
    supplierCode: 'SUP-TEMP',
    supplierName: '临时测试供应商',
    contactName: '张三',
    phone: '123',
    categoryTags: '电阻',
    qualityGrade: 'B级抽检',
    leadTimeDays: 3,
  });
  const { state: sc2, supplier: updSup } = updateSupplier(sc1, 'SUP-TEMP', {
    supplierName: '临时供应商(更新)',
    contactName: '李四',
    phone: '456',
    categoryTags: '电容',
    qualityGrade: 'A级免检',
    leadTimeDays: 5,
  });
  assert.equal(updSup.supplierName, '临时供应商(更新)');
  assert.throws(() => deleteSupplier(sc2, 'SUP-ARROW'), /已被物料主数据/);
  const { state: sc3 } = deleteSupplier(sc2, 'SUP-TEMP');
  assert.equal(sc3.suppliers.some((s) => s.supplierCode === 'SUP-TEMP'), false);

  const { state: sc4, customer: tempCus } = addCustomer(sc3, {
    customerCode: 'CUS-TEMP',
    customerName: '临时测试客户',
    contactName: '王五',
    phone: '789',
    industry: '消费电子',
    traceRequirement: 'UID追溯',
    deliveryAddress: '东莞',
  });
  const { state: sc5, customer: updCus } = updateCustomer(sc4, 'CUS-TEMP', {
    customerName: '临时测试客户(已更名)',
    contactName: '王五',
    phone: '789',
    industry: '工控',
    traceRequirement: 'UID追溯',
    deliveryAddress: '深圳',
  });
  assert.equal(updCus.customerName, '临时测试客户(已更名)');
  assert.throws(() => deleteCustomer(sc5, 'CUS-DJI'), /已被物料主数据/);
  const { state: sc6 } = deleteCustomer(sc5, 'CUS-TEMP');
  assert.equal(sc6.customers.some((c) => c.customerCode === 'CUS-TEMP'), false);

  // 6. BOM delete + WO reference guard
  const { state: bm1, bom: tempBom } = saveBomMaster(sc6, {
    productCode: 'PCBA-TEMP-DEL',
    productName: '待删测试机型',
    version: 'V1.0',
    processType: 'SMT',
    items: [{ skuCode: 'MAT-RES-001', qtyPerBoard: 2, attritionRate: 0.02, designators: 'R1-R2' }],
  });
  assert.throws(() => deleteBomMaster(bm1, 'BOM-CTRL-V3'), /已被工单/);
  const { state: bm2 } = deleteBomMaster(bm1, tempBom.bomId);
  assert.equal(bm2.boms.some((b) => b.bomId === tempBom.bomId), false);
});

test('zplEngine compiles 203/300dpi CODE128, QR, DataMatrix and custom ZPL templates accurately', () => {
  const seed = createSeedData();
  const reel = seed.reels[0];
  const mat = seed.materials.find((m) => m.skuCode === reel.skuCode);

  // 1. mmToDots precision
  assert.equal(mmToDots(50, 203), 400);
  assert.equal(mmToDots(70, 203), 559);
  assert.equal(mmToDots(100, 300), 1181);

  // 2. ZPL sanitization prevents ^ and ~ injection
  assert.equal(sanitizeZplText('ABC^XZ~HS\nDEF'), 'ABC-XZ-HS DEF');

  // 3. Visual mode CODE128 @ 203dpi
  const stdTpl = seed.labelTemplates.find((t) => t.templateId === 'TPL-STD-50X30')!;
  const zpl128 = generateZplFromTemplate({
    template: stdTpl,
    reel,
    material: mat,
    copies: 3,
    darkness: 20,
    printSpeed: 5,
  });
  assert.match(zpl128, /^\^XA/);
  assert.match(zpl128, /\^PW400/);
  assert.match(zpl128, /\^LL240/);
  assert.match(zpl128, /\^MD20/);
  assert.match(zpl128, /\^PR5/);
  assert.match(zpl128, /\^BCN,/);
  assert.match(zpl128, new RegExp(`\\^FD${reel.reelId}\\^FS`));
  assert.match(zpl128, /\^PQ3,0,1,Y/);
  assert.match(zpl128, /\^XZ$/);

  // 4. Visual mode QR @ 203dpi and DataMatrix @ 300dpi
  const qrTpl = seed.labelTemplates.find((t) => t.templateId === 'TPL-CONSIGN-70X40')!;
  const zplQr = generateZplFromTemplate({ template: qrTpl, reel, material: mat });
  assert.match(zplQr, /\^BQN,2,/);
  assert.match(zplQr, /\^PW559/);

  const dmTpl = seed.labelTemplates.find((t) => t.templateId === 'TPL-BOX-100X60')!;
  const zplDm = generateZplFromTemplate({ template: dmTpl, reel, material: mat });
  assert.match(zplDm, /\^BXN,/);
  assert.match(zplDm, /\^PW1181/);

  // 5. Custom ZPL mode interpolates variables & injects ^PQ copies if missing
  const { state: s1, template: customTpl } = saveLabelTemplate(seed, {
    templateName: '客户定制二维码标',
    paperSize: '70x40mm',
    dpi: 300,
    barcodeType: 'QR',
    zplMode: 'CUSTOM_ZPL',
    fontScale: 'STANDARD',
    barcodeHeightMm: 10,
    customZpl: '^XA\n^CI28\n^FO30,30^A0N,36,30^FD{{MPN}}^FS\n^FO30,90^BQN,2,5^FDQA,{{COMPOSITE}}^FS\n^XZ',
    headerTitle: '定制标',
    footerNote: '定制页脚',
    showFields: {
      mpn: true,
      skuCode: true,
      ownership: true,
      packagingMpq: true,
      supplier: true,
      lotDateCode: true,
      binMsd: true,
      compositeBarcode: true,
    },
    isDefault: false,
  });
  assert.equal(customTpl.dpi, 300);
  assert.equal(customTpl.zplMode, 'CUSTOM_ZPL');
  const compiledCustom = generateZplFromTemplate({
    template: customTpl,
    reel,
    material: mat,
    copies: 4,
  });
  assert.match(compiledCustom, new RegExp(`\\^FD${reel.mpn}\\^FS`));
  assert.match(compiledCustom, /\^PQ4,0,1,Y/);

  // 6. 2D preview matrix generation & Zebra printerConfig persistence + legacy normalization
  const qrMat = generatePseudo2dMatrix(reel.reelId, 'QR', 21);
  assert.equal(qrMat.length, 21);
  assert.equal(qrMat[0][0], true);

  assert.throws(() => savePrinterConfig(s1, { mode: 'LAN_TCP', host: '' }), /IP\/主机名不能为空/);
  assert.throws(() => savePrinterConfig(s1, { port: 99999 }), /端口号/);
  const { state: s2, printerConfig } = savePrinterConfig(s1, {
    mode: 'LAN_TCP',
    host: '192.168.50.120',
    port: 9100,
    darkness: 22,
    printSpeed: 6,
  });
  assert.equal(printerConfig.host, '192.168.50.120');
  assert.equal(printerConfig.darkness, 22);

  // Legacy store missing printerConfig & ZPL fields normalizes cleanly
  const normalized = normalizeWmsState(
    {
      ...s2,
      printerConfig: undefined,
      labelTemplates: [
        {
          templateId: 'LEGACY-TPL',
          templateName: '旧版模板',
          paperSize: '50x30mm',
          headerTitle: '旧版',
          footerNote: '页脚',
          showFields: {
            mpn: true,
            skuCode: true,
            ownership: true,
            packagingMpq: true,
            supplier: false,
            lotDateCode: true,
            binMsd: true,
            compositeBarcode: true,
          },
          isDefault: false,
        },
      ],
    },
    seed
  );
  assert.equal(normalized.printerConfig?.port, 9100);
  assert.equal(normalized.labelTemplates[0].dpi, 203);
  assert.equal(normalized.labelTemplates[0].barcodeType, 'CODE128');
});





