import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedData } from '../data/seedData';
import {
  addCustomer,
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
  computeLowStockAlerts,
  computeSmtAnomalies,
  computeWorkOrderKitting,
  consolidateWaveDemand,
  createAsnOrder,
  createCycleCountTask,
  createWaveOrder,
  importAsnFromCsv,
  issueWaveAllocation,
  normalizeWmsState,
  parseBarcodeString,
  saveBomMaster,
  traceByQuery,
} from './wmsLogic';

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



