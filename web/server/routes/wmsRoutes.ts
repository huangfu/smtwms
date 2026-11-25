import { Router, type Response } from 'express';
import {
  addCustomer,
  addMaterialSku,
  addPackagingSpec,
  addSupplier,
  addWarehouse,
  addWarehouseBin,
  addWarehouseKeeper,
  addWorkOrder,
  applyCycleCountReconcile,
  applyGeneralOutbound,
  applyInbound,
  applyProductionReturn,
  applyReplenishment,
  applyScrap,
  bakeMsdReel,
  cancelAsnOrder,
  confirmAsnDeliveryArrival,
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
  inspectAsnLineIqc,
  issueWaveAllocation,
  putawayAsnLine,
  saveBarcodeRule,
  saveBomMaster,
  saveLabelTemplate,
  savePrinterConfig,
  scanAsnReceiving,
  syncAsnOrderInfo,
  updateCustomer,
  updateMaterialSku,
  updatePackagingSpec,
  updateSupplier,
  updateWarehouse,
  updateWarehouseBin,
  updateWarehouseKeeper,
} from '../../shared/domain/wmsLogic.ts';
import type { WmsState } from '../../shared/types/wms.ts';
import {
  BusinessRuleError,
  loadUserWmsState,
  mutateUserWmsState,
  resetUserWmsState,
} from '../db/wmsRepository.ts';
import { requireAuth, requireRoles, type AuthRequest } from '../middleware/auth.ts';
import { createPrintRouter } from './printRoutes.ts';

async function handleMutation(
  req: AuthRequest,
  res: Response,
  fn: (current: WmsState) => { state: WmsState; payload?: unknown }
): Promise<void> {
  const ownerUid = req.user?.uid;
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: '未登录，请重新登录。' });
    return;
  }

  try {
    const result = await mutateUserWmsState(ownerUid, fn);
    res.json({ ok: true, state: result.state, payload: result.payload ?? null });
  } catch (err) {
    if (err instanceof BusinessRuleError) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }
    console.error('WMS mutation error:', err);
    const message = err instanceof Error ? err.message : '操作失败，请稍后重试。';
    res.status(500).json({ ok: false, error: message });
  }
}

export function createWmsRouter(): Router {
  const router = Router();
  const requireWarehouse = requireRoles('WAREHOUSE', 'ADMIN');
  const requireWarehouseOrProduction = requireRoles('WAREHOUSE', 'PRODUCTION', 'ADMIN');
  const requireProcurement = requireRoles('PROCUREMENT', 'ADMIN');
  const requireIqc = requireRoles('IQC', 'ADMIN');

  // All WMS API endpoints strictly require a verified first-party local session token
  router.use(requireAuth);

  // State & Reset
  router.get('/state', async (req: AuthRequest, res) => {
    const ownerUid = req.user?.uid;
    if (!ownerUid) {
      res.status(401).json({ ok: false, error: '未登录，请重新登录。' });
      return;
    }
    try {
      const state = await loadUserWmsState(ownerUid);
      res.json({ ok: true, state });
    } catch (err) {
      console.error('Failed to load WMS state:', err);
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : '仓储数据加载失败，请稍后重试。',
      });
    }
  });

  router.post('/reset', async (req: AuthRequest, res) => {
    const ownerUid = req.user?.uid;
    if (!ownerUid) {
      res.status(401).json({ ok: false, error: '未登录，请重新登录。' });
      return;
    }
    try {
      const state = await resetUserWmsState(ownerUid);
      res.json({ ok: true, state });
    } catch (err) {
      console.error('Failed to reset WMS state:', err);
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : '重置数据失败，请稍后重试。',
      });
    }
  });

  // Warehouse core inventory operations
  router.post('/inbound', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = applyInbound(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  router.post('/outbound', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = applyGeneralOutbound(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  router.post('/waves', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = createWaveOrder(cur, req.body);
      return {
        state: result.state,
        payload: { wave: result.wave, shortages: result.shortages },
      };
    });
  });

  router.post('/waves/:waveId/issue', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = issueWaveAllocation(cur, {
        waveId: req.params.waveId,
        reelId: req.body.reelId,
        operator: req.body.operator,
      });
      return { state: result.state, payload: { wave: result.wave, event: result.event } };
    });
  });

  // SMT Production + Warehouse shared replenishment & return operations
  router.post('/replenish', requireWarehouseOrProduction, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = applyReplenishment(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  router.post('/return', requireWarehouseOrProduction, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = applyProductionReturn(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  router.post('/msd-bake', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = bakeMsdReel(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  router.post('/scrap', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = applyScrap(cur, req.body);
      return { state: result.state, payload: { scrap: result.scrap, event: result.event } };
    });
  });

  router.post('/cycle-counts', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = createCycleCountTask(cur, req.body);
      return { state: result.state, payload: { task: result.task } };
    });
  });

  router.post(
    '/cycle-counts/:countId/reconcile',
    requireWarehouse,
    async (req: AuthRequest, res) => {
      await handleMutation(req, res, (cur) => {
        const result = applyCycleCountReconcile(cur, {
          countId: req.params.countId,
          counts: req.body.counts,
          operator: req.body.operator,
        });
        return { state: result.state, payload: { task: result.task } };
      });
    }
  );

  // Warehouse-owned master data (materials, warehouses, bins, keepers, BOMs, packaging, barcode/ZPL)
  router.post('/materials', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = addMaterialSku(cur, req.body);
      return { state: result.state, payload: { material: result.material } };
    });
  });

  router.put('/materials', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = updateMaterialSku(cur, req.body.originalKey, req.body.material);
      return { state: result.state, payload: { material: result.material } };
    });
  });

  router.delete('/materials', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const key = String(req.body?.materialKey || req.query.materialKey || '');
      const result = deleteMaterialSku(cur, key);
      return { state: result.state };
    });
  });

  // Production + Warehouse shared work-order creation
  router.post('/work-orders', requireWarehouseOrProduction, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = addWorkOrder(cur, req.body);
      return { state: result.state, payload: { workOrder: result.workOrder } };
    });
  });

  router.post('/warehouses', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = addWarehouse(cur, req.body);
      return { state: result.state, payload: { warehouse: result.warehouse } };
    });
  });

  router.put('/warehouses/:code', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = updateWarehouse(cur, req.params.code, req.body);
      return { state: result.state, payload: { warehouse: result.warehouse } };
    });
  });

  router.delete('/warehouses/:code', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = deleteWarehouse(cur, req.params.code);
      return { state: result.state };
    });
  });

  router.post('/bins', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = addWarehouseBin(cur, req.body);
      return { state: result.state, payload: { bin: result.bin } };
    });
  });

  router.put('/bins/:binCode', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = updateWarehouseBin(cur, req.params.binCode, req.body);
      return { state: result.state, payload: { bin: result.bin } };
    });
  });

  router.delete('/bins/:binCode', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = deleteWarehouseBin(cur, req.params.binCode);
      return { state: result.state };
    });
  });

  router.post('/keepers', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = addWarehouseKeeper(cur, req.body);
      return { state: result.state, payload: { keeper: result.keeper } };
    });
  });

  router.put('/keepers/:keeperId', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = updateWarehouseKeeper(cur, req.params.keeperId, req.body);
      return { state: result.state, payload: { keeper: result.keeper } };
    });
  });

  router.delete('/keepers/:keeperId', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = deleteWarehouseKeeper(cur, req.params.keeperId);
      return { state: result.state };
    });
  });

  // Procurement-owned master data (suppliers & customers)
  router.post('/suppliers', requireProcurement, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = addSupplier(cur, req.body);
      return { state: result.state, payload: { supplier: result.supplier } };
    });
  });

  router.put('/suppliers/:code', requireProcurement, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = updateSupplier(cur, req.params.code, req.body);
      return { state: result.state, payload: { supplier: result.supplier } };
    });
  });

  router.delete('/suppliers/:code', requireProcurement, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = deleteSupplier(cur, req.params.code);
      return { state: result.state };
    });
  });

  router.post('/customers', requireProcurement, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = addCustomer(cur, req.body);
      return { state: result.state, payload: { customer: result.customer } };
    });
  });

  router.put('/customers/:code', requireProcurement, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = updateCustomer(cur, req.params.code, req.body);
      return { state: result.state, payload: { customer: result.customer } };
    });
  });

  router.delete('/customers/:code', requireProcurement, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = deleteCustomer(cur, req.params.code);
      return { state: result.state };
    });
  });

  router.post('/boms', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = saveBomMaster(cur, req.body);
      return { state: result.state, payload: { bom: result.bom } };
    });
  });

  router.delete('/boms/:bomId', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = deleteBomMaster(cur, req.params.bomId);
      return { state: result.state };
    });
  });

  router.post('/packaging-specs', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = addPackagingSpec(cur, req.body);
      return { state: result.state, payload: { spec: result.spec } };
    });
  });

  router.put('/packaging-specs/:code', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = updatePackagingSpec(cur, req.params.code, req.body);
      return { state: result.state, payload: { spec: result.spec } };
    });
  });

  router.delete('/packaging-specs/:code', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = deletePackagingSpec(cur, req.params.code);
      return { state: result.state };
    });
  });

  router.post('/barcode-rules', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = saveBarcodeRule(cur, req.body);
      return { state: result.state, payload: { rule: result.rule } };
    });
  });

  router.delete('/barcode-rules/:ruleId', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = deleteBarcodeRule(cur, req.params.ruleId);
      return { state: result.state };
    });
  });

  router.post('/label-templates', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = saveLabelTemplate(cur, req.body);
      return { state: result.state, payload: { template: result.template } };
    });
  });

  router.delete(
    '/label-templates/:templateId',
    requireWarehouse,
    async (req: AuthRequest, res) => {
      await handleMutation(req, res, (cur) => {
        const result = deleteLabelTemplate(cur, req.params.templateId);
        return { state: result.state };
      });
    }
  );

  // Procurement-exclusive ASN dispatch routes
  router.post('/asns', requireProcurement, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = createAsnOrder(cur, req.body);
      return { state: result.state, payload: { asn: result.asn } };
    });
  });

  router.post('/asns/import-csv', requireProcurement, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = importAsnFromCsv(cur, req.body);
      return { state: result.state, payload: { asn: result.asn } };
    });
  });

  router.post('/asns/:asnNo/cancel', requireProcurement, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = cancelAsnOrder(cur, req.params.asnNo);
      return { state: result.state, payload: { asn: result.asn } };
    });
  });

  // Warehouse-exclusive arrival & receiving routes
  router.post('/asns/:asnNo/arrive', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = confirmAsnDeliveryArrival(cur, {
        asnNo: req.params.asnNo,
        deliveryNoteNo: req.body?.deliveryNoteNo,
        carrierName: req.body?.carrierName,
        operator: req.body?.operator,
      });
      return {
        state: result.state,
        payload: { asn: result.asn, stageAdvancedTo: result.stageAdvancedTo },
      };
    });
  });

  router.post('/asns/:asnNo/scan-receive', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = scanAsnReceiving(cur, {
        ...req.body,
        asnNo: req.params.asnNo,
      });
      return {
        state: result.state,
        payload: {
          asn: result.asn,
          matchedLine: result.matchedLine,
          addedQty: result.addedQty,
          lineBucket: result.lineBucket,
          stageAdvancedTo: result.stageAdvancedTo,
          parsed: result.parsed,
        },
      };
    });
  });

  // IQC-exclusive incoming inspection route
  router.post('/asns/:asnNo/iqc', requireIqc, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = inspectAsnLineIqc(cur, {
        ...req.body,
        asnNo: req.params.asnNo,
      });
      return {
        state: result.state,
        payload: {
          asn: result.asn,
          matchedLine: result.matchedLine,
          passedAdded: result.passedAdded,
          rejectedAdded: result.rejectedAdded,
          lineBucket: result.lineBucket,
          stageAdvancedTo: result.stageAdvancedTo,
        },
      };
    });
  });

  // Warehouse-exclusive qualified putaway & ERP/MES sync routes
  router.post('/asns/:asnNo/putaway', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = putawayAsnLine(cur, {
        ...req.body,
        asnNo: req.params.asnNo,
      });
      return {
        state: result.state,
        payload: {
          asn: result.asn,
          matchedLine: result.matchedLine,
          reel: result.reel,
          stageAdvancedTo: result.stageAdvancedTo,
        },
      };
    });
  });

  router.post('/asns/:asnNo/sync', requireWarehouse, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = syncAsnOrderInfo(cur, {
        asnNo: req.params.asnNo,
        syncChannel: req.body?.syncChannel,
      });
      return { state: result.state, payload: { asn: result.asn } };
    });
  });

  router.put('/printer-config', requireWarehouseOrProduction, async (req: AuthRequest, res) => {
    await handleMutation(req, res, (cur) => {
      const result = savePrinterConfig(cur, req.body);
      return { state: result.state, payload: { printerConfig: result.printerConfig } };
    });
  });

  // Zebra TCP 9100 direct print sub-router
  router.use('/print', createPrintRouter());

  return router;
}
