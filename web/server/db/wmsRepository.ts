import { asc, eq } from 'drizzle-orm';
import { createSeedData } from '../../shared/data/seedData.ts';
import type { WmsState } from '../../shared/types/wms.ts';
import { normalizeWmsState } from '../../shared/domain/wmsLogic.ts';
import { db } from './index.ts';
import {
  asnOrders,
  barcodeRules,
  bomMasters,
  customers,
  cycleCounts,
  labelTemplates,
  materials,
  packagingSpecs,
  reels,
  scrapRecords,
  suppliers,
  traceEvents,
  warehouseBins,
  warehouseKeepers,
  warehouses,
  waveOrders,
  wmsWorkspaces,
  workOrders,
} from './schema.ts';
import {
  ALL_WMS_SLICE_KEYS,
  detectChangedSlices,
  mapRowsToPartialWmsState,
  serializeAsnLinesWithMeta,
  serializeBarcodeRuleFieldMap,
  type WmsSliceKey,
} from './wmsMapper.ts';

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

const userLocks = new Map<string, Promise<unknown>>();

async function withUserLock<T>(ownerUid: string, task: () => Promise<T>): Promise<T> {
  const previous = userLocks.get(ownerUid) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.catch(() => undefined).then(() => current);
  userLocks.set(ownerUid, chained);

  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
    if (userLocks.get(ownerUid) === chained) {
      userLocks.delete(ownerUid);
    }
  }
}

async function persistSlicesInTx(
  tx: TxClient,
  ownerUid: string,
  state: WmsState,
  slices: WmsSliceKey[]
): Promise<void> {
  const sliceSet = new Set(slices);

  if (sliceSet.has('printerConfig')) {
    await tx
      .insert(wmsWorkspaces)
      .values({
        ownerUid,
        printerConfig: state.printerConfig ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: wmsWorkspaces.ownerUid,
        set: {
          printerConfig: state.printerConfig ?? null,
          updatedAt: new Date(),
        },
      });
  } else {
    await tx
      .update(wmsWorkspaces)
      .set({ updatedAt: new Date() })
      .where(eq(wmsWorkspaces.ownerUid, ownerUid));
  }

  if (sliceSet.has('warehouses')) {
    await tx.delete(warehouses).where(eq(warehouses.ownerUid, ownerUid));
    if (state.warehouses.length > 0) {
      await tx.insert(warehouses).values(
        state.warehouses.map((w) => ({
          ownerUid,
          warehouseCode: w.warehouseCode,
          warehouseName: w.warehouseName,
          warehouseType: w.warehouseType,
          managerId: w.managerId,
          managerName: w.managerName,
          address: w.address,
          status: w.status,
          createdAt: w.createdAt,
        }))
      );
    }
  }

  if (sliceSet.has('keepers')) {
    await tx.delete(warehouseKeepers).where(eq(warehouseKeepers.ownerUid, ownerUid));
    if (state.keepers.length > 0) {
      await tx.insert(warehouseKeepers).values(
        state.keepers.map((k) => ({
          ownerUid,
          keeperId: k.keeperId,
          employeeNo: k.employeeNo,
          name: k.name,
          role: k.role,
          warehouseCode: k.warehouseCode,
          phone: k.phone,
          shift: k.shift,
          status: k.status,
        }))
      );
    }
  }

  if (sliceSet.has('bins')) {
    await tx.delete(warehouseBins).where(eq(warehouseBins.ownerUid, ownerUid));
    if (state.bins.length > 0) {
      await tx.insert(warehouseBins).values(
        state.bins.map((b) => ({
          ownerUid,
          binCode: b.binCode,
          warehouseCode: b.warehouseCode ?? null,
          zone: b.zone,
          capacityReels: b.capacityReels,
          keeperName: b.keeperName ?? null,
          description: b.description,
        }))
      );
    }
  }

  if (sliceSet.has('suppliers')) {
    await tx.delete(suppliers).where(eq(suppliers.ownerUid, ownerUid));
    if (state.suppliers.length > 0) {
      await tx.insert(suppliers).values(
        state.suppliers.map((s) => ({
          ownerUid,
          supplierCode: s.supplierCode,
          supplierName: s.supplierName,
          contactName: s.contactName,
          phone: s.phone,
          categoryTags: s.categoryTags,
          qualityGrade: s.qualityGrade,
          leadTimeDays: s.leadTimeDays,
          notes: s.notes ?? null,
        }))
      );
    }
  }

  if (sliceSet.has('customers')) {
    await tx.delete(customers).where(eq(customers.ownerUid, ownerUid));
    if (state.customers.length > 0) {
      await tx.insert(customers).values(
        state.customers.map((c) => ({
          ownerUid,
          customerCode: c.customerCode,
          customerName: c.customerName,
          contactName: c.contactName,
          phone: c.phone,
          industry: c.industry,
          traceRequirement: c.traceRequirement,
          deliveryAddress: c.deliveryAddress,
        }))
      );
    }
  }

  if (sliceSet.has('packagingSpecs')) {
    await tx.delete(packagingSpecs).where(eq(packagingSpecs.ownerUid, ownerUid));
    if (state.packagingSpecs.length > 0) {
      await tx.insert(packagingSpecs).values(
        state.packagingSpecs.map((p) => ({
          ownerUid,
          packagingCode: p.packagingCode,
          packagingName: p.packagingName,
          carrierType: p.carrierType,
          reelDiameter: p.reelDiameter,
          tapeWidthMm: p.tapeWidthMm,
          pitchMm: p.pitchMm,
          defaultSpq: p.defaultSpq,
          allowSplit: p.allowSplit,
          allowMerge: p.allowMerge,
          description: p.description,
        }))
      );
    }
  }

  if (sliceSet.has('barcodeRules')) {
    await tx.delete(barcodeRules).where(eq(barcodeRules.ownerUid, ownerUid));
    if (state.barcodeRules.length > 0) {
      await tx.insert(barcodeRules).values(
        state.barcodeRules.map((r) => ({
          ownerUid,
          ruleId: r.ruleId,
          ruleName: r.ruleName,
          supplierCode: r.supplierCode,
          supplierName: r.supplierName,
          formatType: r.formatType,
          delimiter: r.delimiter,
          fieldMap: serializeBarcodeRuleFieldMap(r),
          sampleBarcode: r.sampleBarcode,
          enabled: r.enabled,
        }))
      );
    }
  }

  if (sliceSet.has('labelTemplates')) {
    await tx.delete(labelTemplates).where(eq(labelTemplates.ownerUid, ownerUid));
    if (state.labelTemplates.length > 0) {
      await tx.insert(labelTemplates).values(
        state.labelTemplates.map((t) => ({
          ownerUid,
          templateId: t.templateId,
          templateName: t.templateName,
          paperSize: t.paperSize,
          customWidthMm: t.customWidthMm ?? null,
          customHeightMm: t.customHeightMm ?? null,
          dpi: t.dpi ?? null,
          offsetXMm: t.offsetXMm ?? null,
          offsetYMm: t.offsetYMm ?? null,
          barcodeType: t.barcodeType ?? null,
          zplMode: t.zplMode ?? null,
          elementOrder: t.elementOrder ?? null,
          elementLayouts: t.elementLayouts ?? null,
          fontScale: t.fontScale ?? null,
          barcodeHeightMm: t.barcodeHeightMm ?? null,
          customZpl: t.customZpl ?? null,
          headerTitle: t.headerTitle,
          footerNote: t.footerNote,
          showFields: t.showFields,
          isDefault: t.isDefault,
        }))
      );
    }
  }

  if (sliceSet.has('materials')) {
    await tx.delete(materials).where(eq(materials.ownerUid, ownerUid));
    if (state.materials.length > 0) {
      await tx.insert(materials).values(
        state.materials.map((m) => ({
          ownerUid,
          materialKey: m.materialKey ?? `${m.skuCode}::${m.ownershipType ?? 'SELF_PURCHASED'}::${m.ownerCode ?? 'SELF'}`,
          skuCode: m.skuCode,
          mpn: m.mpn,
          name: m.name,
          ownershipType: m.ownershipType ?? null,
          ownerCode: m.ownerCode ?? null,
          ownerName: m.ownerName ?? null,
          customerCode: m.customerCode ?? null,
          customerName: m.customerName ?? null,
          manufacturer: m.manufacturer,
          category: m.category,
          packageType: m.packageType,
          packagingCode: m.packagingCode ?? null,
          packagingName: m.packagingName ?? null,
          mpq: m.mpq ?? null,
          supplierCode: m.supplierCode ?? null,
          supplierName: m.supplierName ?? null,
          unit: m.unit,
          msdLevel: m.msdLevel,
          safetyStock: m.safetyStock,
          defaultBin: m.defaultBin,
        }))
      );
    }
  }

  if (sliceSet.has('boms')) {
    await tx.delete(bomMasters).where(eq(bomMasters.ownerUid, ownerUid));
    if (state.boms.length > 0) {
      await tx.insert(bomMasters).values(
        state.boms.map((b) => ({
          ownerUid,
          bomId: b.bomId,
          productCode: b.productCode,
          productName: b.productName,
          version: b.version,
          customerCode: b.customerCode ?? null,
          customerName: b.customerName ?? null,
          processType: b.processType,
          status: b.status,
          items: b.items,
          updatedAt: b.updatedAt,
        }))
      );
    }
  }

  if (sliceSet.has('asns')) {
    await tx.delete(asnOrders).where(eq(asnOrders.ownerUid, ownerUid));
    if (state.asns.length > 0) {
      await tx.insert(asnOrders).values(
        state.asns.map((a) => ({
          ownerUid,
          asnNo: a.asnNo,
          poNo: a.poNo,
          supplierCode: a.supplierCode,
          supplierName: a.supplierName,
          warehouseCode: a.warehouseCode,
          expectedDate: a.expectedDate,
          purchaser: a.purchaser,
          source: a.source,
          status: a.status,
          notes: a.notes ?? null,
          lines: serializeAsnLinesWithMeta(a),
          createdAt: a.createdAt,
        }))
      );
    }
  }

  if (sliceSet.has('reels')) {
    await tx.delete(reels).where(eq(reels.ownerUid, ownerUid));
    if (state.reels.length > 0) {
      await tx.insert(reels).values(
        state.reels.map((r) => ({
          ownerUid,
          reelId: r.reelId,
          parentReelId: r.parentReelId ?? null,
          materialKey: r.materialKey ?? null,
          skuCode: r.skuCode,
          mpn: r.mpn,
          lotNumber: r.lotNumber,
          dateCode: r.dateCode,
          supplier: r.supplier,
          ownershipType: r.ownershipType ?? null,
          ownerCode: r.ownerCode ?? null,
          ownerName: r.ownerName ?? null,
          customerCode: r.customerCode ?? null,
          customerName: r.customerName ?? null,
          packagingCode: r.packagingCode ?? null,
          mpq: r.mpq ?? null,
          receiptDocNo: r.receiptDocNo,
          asnNo: r.asnNo ?? null,
          initialQty: r.initialQty,
          qty: r.qty,
          issuedQty: r.issuedQty,
          binCode: r.binCode,
          msdLevel: r.msdLevel,
          msdState: r.msdState,
          msdOpenAt: r.msdOpenAt ?? null,
          status: r.status,
          workOrderId: r.workOrderId ?? null,
          receivedAt: r.receivedAt,
          updatedAt: r.updatedAt,
        }))
      );
    }
  }

  if (sliceSet.has('workOrders')) {
    await tx.delete(workOrders).where(eq(workOrders.ownerUid, ownerUid));
    if (state.workOrders.length > 0) {
      await tx.insert(workOrders).values(
        state.workOrders.map((w) => ({
          ownerUid,
          workOrderId: w.workOrderId,
          productCode: w.productCode,
          productName: w.productName,
          bomId: w.bomId ?? null,
          customerCode: w.customerCode ?? null,
          customerName: w.customerName ?? null,
          lineName: w.lineName,
          targetQty: w.targetQty,
          status: w.status,
          waveId: w.waveId ?? null,
          bom: w.bom,
          issuedBySku: w.issuedBySku,
          replenishedBySku: w.replenishedBySku,
          returnedBySku: w.returnedBySku,
          createdAt: w.createdAt,
        }))
      );
    }
  }

  if (sliceSet.has('waves')) {
    await tx.delete(waveOrders).where(eq(waveOrders.ownerUid, ownerUid));
    if (state.waves.length > 0) {
      await tx.insert(waveOrders).values(
        state.waves.map((w) => ({
          ownerUid,
          waveId: w.waveId,
          name: w.name,
          workOrderIds: w.workOrderIds,
          status: w.status,
          allocations: w.allocations,
          createdAt: w.createdAt,
          completedAt: w.completedAt ?? null,
        }))
      );
    }
  }

  if (sliceSet.has('cycleCounts')) {
    await tx.delete(cycleCounts).where(eq(cycleCounts.ownerUid, ownerUid));
    if (state.cycleCounts.length > 0) {
      await tx.insert(cycleCounts).values(
        state.cycleCounts.map((c) => ({
          ownerUid,
          countId: c.countId,
          title: c.title,
          zoneFilter: c.zoneFilter,
          status: c.status,
          lines: c.lines,
          createdAt: c.createdAt,
          completedAt: c.completedAt ?? null,
        }))
      );
    }
  }

  if (sliceSet.has('scrapRecords')) {
    await tx.delete(scrapRecords).where(eq(scrapRecords.ownerUid, ownerUid));
    if (state.scrapRecords.length > 0) {
      await tx.insert(scrapRecords).values(
        state.scrapRecords.map((s) => ({
          ownerUid,
          scrapId: s.scrapId,
          timestamp: s.timestamp,
          reelId: s.reelId,
          skuCode: s.skuCode,
          mpn: s.mpn,
          lotNumber: s.lotNumber,
          qty: s.qty,
          reason: s.reason,
          disposition: s.disposition,
          workOrderId: s.workOrderId ?? null,
          operator: s.operator,
        }))
      );
    }
  }

  if (sliceSet.has('traceEvents')) {
    await tx.delete(traceEvents).where(eq(traceEvents.ownerUid, ownerUid));
    if (state.traceEvents.length > 0) {
      await tx.insert(traceEvents).values(
        state.traceEvents.map((e) => ({
          ownerUid,
          eventId: e.eventId,
          timestamp: e.timestamp,
          action: e.action,
          reelId: e.reelId,
          skuCode: e.skuCode,
          mpn: e.mpn,
          lotNumber: e.lotNumber,
          dateCode: e.dateCode,
          qtyDelta: e.qtyDelta,
          balanceAfter: e.balanceAfter,
          fromBin: e.fromBin ?? null,
          toBin: e.toBin ?? null,
          workOrderId: e.workOrderId ?? null,
          waveId: e.waveId ?? null,
          lineOrStation: e.lineOrStation ?? null,
          docNo: e.docNo,
          reason: e.reason ?? null,
          operator: e.operator,
        }))
      );
    }
  }
}

async function readUserStateUnsafe(ownerUid: string): Promise<WmsState> {
  const seed = createSeedData();
  const [workspaceRow] = await db
    .select()
    .from(wmsWorkspaces)
    .where(eq(wmsWorkspaces.ownerUid, ownerUid));

  if (!workspaceRow) {
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(wmsWorkspaces)
        .values({
          ownerUid,
          printerConfig: seed.printerConfig ?? null,
          seededAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning();

      if (inserted.length > 0) {
        await persistSlicesInTx(tx, ownerUid, seed, ALL_WMS_SLICE_KEYS);
      }
    });
    const [verifiedWorkspace] = await db
      .select()
      .from(wmsWorkspaces)
      .where(eq(wmsWorkspaces.ownerUid, ownerUid));
    if (!verifiedWorkspace) {
      return seed;
    }
  }

  const [
    wsRows,
    whRows,
    keeperRows,
    binRows,
    supplierRows,
    customerRows,
    pkgRows,
    ruleRows,
    tplRows,
    matRows,
    bomRows,
    asnRows,
    reelRows,
    woRows,
    waveRows,
    ccRows,
    scrapRows,
    traceRows,
  ] = await Promise.all([
    db.select().from(wmsWorkspaces).where(eq(wmsWorkspaces.ownerUid, ownerUid)),
    db.select().from(warehouses).where(eq(warehouses.ownerUid, ownerUid)).orderBy(asc(warehouses.id)),
    db.select().from(warehouseKeepers).where(eq(warehouseKeepers.ownerUid, ownerUid)).orderBy(asc(warehouseKeepers.id)),
    db.select().from(warehouseBins).where(eq(warehouseBins.ownerUid, ownerUid)).orderBy(asc(warehouseBins.id)),
    db.select().from(suppliers).where(eq(suppliers.ownerUid, ownerUid)).orderBy(asc(suppliers.id)),
    db.select().from(customers).where(eq(customers.ownerUid, ownerUid)).orderBy(asc(customers.id)),
    db.select().from(packagingSpecs).where(eq(packagingSpecs.ownerUid, ownerUid)).orderBy(asc(packagingSpecs.id)),
    db.select().from(barcodeRules).where(eq(barcodeRules.ownerUid, ownerUid)).orderBy(asc(barcodeRules.id)),
    db.select().from(labelTemplates).where(eq(labelTemplates.ownerUid, ownerUid)).orderBy(asc(labelTemplates.id)),
    db.select().from(materials).where(eq(materials.ownerUid, ownerUid)).orderBy(asc(materials.id)),
    db.select().from(bomMasters).where(eq(bomMasters.ownerUid, ownerUid)).orderBy(asc(bomMasters.id)),
    db.select().from(asnOrders).where(eq(asnOrders.ownerUid, ownerUid)).orderBy(asc(asnOrders.id)),
    db.select().from(reels).where(eq(reels.ownerUid, ownerUid)).orderBy(asc(reels.id)),
    db.select().from(workOrders).where(eq(workOrders.ownerUid, ownerUid)).orderBy(asc(workOrders.id)),
    db.select().from(waveOrders).where(eq(waveOrders.ownerUid, ownerUid)).orderBy(asc(waveOrders.id)),
    db.select().from(cycleCounts).where(eq(cycleCounts.ownerUid, ownerUid)).orderBy(asc(cycleCounts.id)),
    db.select().from(scrapRecords).where(eq(scrapRecords.ownerUid, ownerUid)).orderBy(asc(scrapRecords.id)),
    db.select().from(traceEvents).where(eq(traceEvents.ownerUid, ownerUid)).orderBy(asc(traceEvents.id)),
  ]);

  const partial = mapRowsToPartialWmsState({
    printerConfig: wsRows[0]?.printerConfig ?? null,
    warehouses: whRows,
    keepers: keeperRows,
    bins: binRows,
    suppliers: supplierRows,
    customers: customerRows,
    packagingSpecs: pkgRows,
    barcodeRules: ruleRows,
    labelTemplates: tplRows,
    materials: matRows,
    boms: bomRows,
    asns: asnRows,
    reels: reelRows,
    workOrders: woRows,
    waves: waveRows,
    cycleCounts: ccRows,
    scrapRecords: scrapRows,
    traceEvents: traceRows,
  });

  return normalizeWmsState(partial, seed);
}

export async function loadUserWmsState(ownerUid: string): Promise<WmsState> {
  return withUserLock(ownerUid, async () => {
    try {
      return await readUserStateUnsafe(ownerUid);
    } catch (error) {
      console.error('Database query failed in loadUserWmsState:', error);
      throw new Error('仓储数据加载失败，请稍后重试。', { cause: error });
    }
  });
}

export async function resetUserWmsState(ownerUid: string): Promise<WmsState> {
  return withUserLock(ownerUid, async () => {
    try {
      const seed = createSeedData();
      await db.transaction(async (tx) => {
        await persistSlicesInTx(tx, ownerUid, seed, ALL_WMS_SLICE_KEYS);
      });
      return seed;
    } catch (error) {
      console.error('Database query failed in resetUserWmsState:', error);
      throw new Error('重置初始数据失败，请稍后重试。', { cause: error });
    }
  });
}

export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

export async function mutateUserWmsState<P = unknown>(
  ownerUid: string,
  fn: (current: WmsState) => { state: WmsState; payload?: P }
): Promise<{ state: WmsState; payload: P | null }> {
  return withUserLock(ownerUid, async () => {
    let currentState: WmsState;
    try {
      currentState = await readUserStateUnsafe(ownerUid);
    } catch (error) {
      console.error('Database load failed before mutation:', error);
      throw new Error('仓储数据加载失败，请稍后重试。', { cause: error });
    }

    let result: { state: WmsState; payload?: P };
    try {
      result = fn(currentState);
    } catch (err) {
      const message = err instanceof Error ? err.message : '业务校验失败';
      throw new BusinessRuleError(message);
    }

    const changedSlices = detectChangedSlices(currentState, result.state);
    if (changedSlices.length > 0) {
      try {
        await db.transaction(async (tx) => {
          await persistSlicesInTx(tx, ownerUid, result.state, changedSlices);
        });
      } catch (error) {
        console.error('Database commit failed in mutateUserWmsState:', error);
        throw new Error('仓储数据保存失败，请稍后重试。', { cause: error });
      }
    }

    return { state: result.state, payload: result.payload ?? null };
  });
}
