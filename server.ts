import express from 'express';
import fs from 'fs';
import net from 'node:net';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createSeedData } from './src/data/seedData';
import type { WmsState } from './src/types/wms';
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
  saveBarcodeRule,
  saveBomMaster,
  saveLabelTemplate,
  savePrinterConfig,
  updateCustomer,
  updateMaterialSku,
  updatePackagingSpec,
  updateSupplier,
  updateWarehouse,
  updateWarehouseBin,
  updateWarehouseKeeper,
} from './src/utils/wmsLogic';

function formatTcpPrintError(host: string, port: number, err: unknown): string {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === 'ECONNREFUSED') {
    return `无法连接 Zebra 打印机 (${host}:${port})：端口拒绝连接。请确认打印机已开机、端口为 9100，且打印服务器与打印机处于同一局域网。`;
  }
  if (code === 'ETIMEDOUT' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return `连接 Zebra 打印机 (${host}:${port}) 超时或网络不可达。若 WMS 部署在云端且无法直连车间内网 IP，请切换为本机「USB / Zebra Browser Print」模式或下载 .zpl 文件。`;
  }
  if (code === 'ENOTFOUND') {
    return `无法解析打印机主机名 "${host}"，请检查 IP 地址或局域网 DNS。`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return `Zebra TCP 通信失败 (${host}:${port})：${msg}`;
}

function testZebraTcpConnection(
  host: string,
  port: number,
  timeoutMs = 3000
): Promise<{ latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let settled = false;
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) {
        reject(new Error(formatTcpPrintError(host, port, err)));
      } else {
        resolve({ latencyMs: Date.now() - start });
      }
    };

    socket.once('connect', () => finish());
    socket.once('timeout', () => {
      const e = new Error('连接超时') as NodeJS.ErrnoException;
      e.code = 'ETIMEDOUT';
      finish(e);
    });
    socket.once('error', (err) => finish(err));
  });
}

function sendZebraTcpZpl(
  host: string,
  port: number,
  zpl: string,
  timeoutMs = 4500
): Promise<{ bytesSent: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const payload = Buffer.from(zpl, 'utf8');
    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new Error(formatTcpPrintError(host, port, err)));
    };

    socket.once('connect', () => {
      socket.write(payload, (writeErr) => {
        if (writeErr) {
          fail(writeErr);
          return;
        }
        socket.end(() => {
          if (settled) return;
          settled = true;
          resolve({ bytesSent: payload.byteLength });
        });
      });
    });

    socket.once('timeout', () => {
      const e = new Error('发送超时') as NodeJS.ErrnoException;
      e.code = 'ETIMEDOUT';
      fail(e);
    });
    socket.once('error', fail);
  });
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'wms-store.json');

function loadState(): WmsState {
  const seed = createSeedData();
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<WmsState>;
      if (parsed && Array.isArray(parsed.reels) && Array.isArray(parsed.materials)) {
        const normalized = normalizeWmsState(parsed, seed);
        return normalized;
      }
    }
  } catch (err) {
    console.error('Failed to read wms-store.json, resetting to seed:', err);
  }
  saveState(seed);
  return seed;
}

function saveState(state: WmsState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  let state = loadState();

  const handleMutation = (
    res: express.Response,
    fn: (current: WmsState) => { state: WmsState; payload?: unknown }
  ) => {
    try {
      const result = fn(state);
      state = result.state;
      saveState(state);
      res.json({ ok: true, state, payload: result.payload ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败';
      res.status(400).json({ ok: false, error: message });
    }
  };

  app.get('/api/wms/state', (_req, res) => {
    res.json({ ok: true, state });
  });

  app.post('/api/wms/reset', (_req, res) => {
    state = createSeedData();
    saveState(state);
    res.json({ ok: true, state });
  });

  app.post('/api/wms/inbound', (req, res) => {
    handleMutation(res, (cur) => {
      const result = applyInbound(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  app.post('/api/wms/outbound', (req, res) => {
    handleMutation(res, (cur) => {
      const result = applyGeneralOutbound(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  app.post('/api/wms/waves', (req, res) => {
    handleMutation(res, (cur) => {
      const result = createWaveOrder(cur, req.body);
      return {
        state: result.state,
        payload: { wave: result.wave, shortages: result.shortages },
      };
    });
  });

  app.post('/api/wms/waves/:waveId/issue', (req, res) => {
    handleMutation(res, (cur) => {
      const result = issueWaveAllocation(cur, {
        waveId: req.params.waveId,
        reelId: req.body.reelId,
        operator: req.body.operator,
      });
      return { state: result.state, payload: { wave: result.wave, event: result.event } };
    });
  });

  app.post('/api/wms/replenish', (req, res) => {
    handleMutation(res, (cur) => {
      const result = applyReplenishment(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  app.post('/api/wms/return', (req, res) => {
    handleMutation(res, (cur) => {
      const result = applyProductionReturn(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  app.post('/api/wms/msd-bake', (req, res) => {
    handleMutation(res, (cur) => {
      const result = bakeMsdReel(cur, req.body);
      return { state: result.state, payload: { reel: result.reel, event: result.event } };
    });
  });

  app.post('/api/wms/scrap', (req, res) => {
    handleMutation(res, (cur) => {
      const result = applyScrap(cur, req.body);
      return { state: result.state, payload: { scrap: result.scrap, event: result.event } };
    });
  });

  app.post('/api/wms/cycle-counts', (req, res) => {
    handleMutation(res, (cur) => {
      const result = createCycleCountTask(cur, req.body);
      return { state: result.state, payload: { task: result.task } };
    });
  });

  app.post('/api/wms/cycle-counts/:countId/reconcile', (req, res) => {
    handleMutation(res, (cur) => {
      const result = applyCycleCountReconcile(cur, {
        countId: req.params.countId,
        counts: req.body.counts,
        operator: req.body.operator,
      });
      return { state: result.state, payload: { task: result.task } };
    });
  });

  app.post('/api/wms/materials', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addMaterialSku(cur, req.body);
      return { state: result.state, payload: { material: result.material } };
    });
  });

  app.put('/api/wms/materials', (req, res) => {
    handleMutation(res, (cur) => {
      const result = updateMaterialSku(cur, req.body.originalKey, req.body.material);
      return { state: result.state, payload: { material: result.material } };
    });
  });

  app.delete('/api/wms/materials', (req, res) => {
    handleMutation(res, (cur) => {
      const key = String(req.body?.materialKey || req.query.materialKey || '');
      const result = deleteMaterialSku(cur, key);
      return { state: result.state };
    });
  });

  app.post('/api/wms/work-orders', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addWorkOrder(cur, req.body);
      return { state: result.state, payload: { workOrder: result.workOrder } };
    });
  });

  app.post('/api/wms/warehouses', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addWarehouse(cur, req.body);
      return { state: result.state, payload: { warehouse: result.warehouse } };
    });
  });

  app.put('/api/wms/warehouses/:code', (req, res) => {
    handleMutation(res, (cur) => {
      const result = updateWarehouse(cur, req.params.code, req.body);
      return { state: result.state, payload: { warehouse: result.warehouse } };
    });
  });

  app.delete('/api/wms/warehouses/:code', (req, res) => {
    handleMutation(res, (cur) => {
      const result = deleteWarehouse(cur, req.params.code);
      return { state: result.state };
    });
  });

  app.post('/api/wms/bins', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addWarehouseBin(cur, req.body);
      return { state: result.state, payload: { bin: result.bin } };
    });
  });

  app.put('/api/wms/bins/:binCode', (req, res) => {
    handleMutation(res, (cur) => {
      const result = updateWarehouseBin(cur, req.params.binCode, req.body);
      return { state: result.state, payload: { bin: result.bin } };
    });
  });

  app.delete('/api/wms/bins/:binCode', (req, res) => {
    handleMutation(res, (cur) => {
      const result = deleteWarehouseBin(cur, req.params.binCode);
      return { state: result.state };
    });
  });

  app.post('/api/wms/keepers', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addWarehouseKeeper(cur, req.body);
      return { state: result.state, payload: { keeper: result.keeper } };
    });
  });

  app.put('/api/wms/keepers/:keeperId', (req, res) => {
    handleMutation(res, (cur) => {
      const result = updateWarehouseKeeper(cur, req.params.keeperId, req.body);
      return { state: result.state, payload: { keeper: result.keeper } };
    });
  });

  app.delete('/api/wms/keepers/:keeperId', (req, res) => {
    handleMutation(res, (cur) => {
      const result = deleteWarehouseKeeper(cur, req.params.keeperId);
      return { state: result.state };
    });
  });

  app.post('/api/wms/suppliers', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addSupplier(cur, req.body);
      return { state: result.state, payload: { supplier: result.supplier } };
    });
  });

  app.put('/api/wms/suppliers/:code', (req, res) => {
    handleMutation(res, (cur) => {
      const result = updateSupplier(cur, req.params.code, req.body);
      return { state: result.state, payload: { supplier: result.supplier } };
    });
  });

  app.delete('/api/wms/suppliers/:code', (req, res) => {
    handleMutation(res, (cur) => {
      const result = deleteSupplier(cur, req.params.code);
      return { state: result.state };
    });
  });

  app.post('/api/wms/customers', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addCustomer(cur, req.body);
      return { state: result.state, payload: { customer: result.customer } };
    });
  });

  app.put('/api/wms/customers/:code', (req, res) => {
    handleMutation(res, (cur) => {
      const result = updateCustomer(cur, req.params.code, req.body);
      return { state: result.state, payload: { customer: result.customer } };
    });
  });

  app.delete('/api/wms/customers/:code', (req, res) => {
    handleMutation(res, (cur) => {
      const result = deleteCustomer(cur, req.params.code);
      return { state: result.state };
    });
  });

  app.post('/api/wms/boms', (req, res) => {
    handleMutation(res, (cur) => {
      const result = saveBomMaster(cur, req.body);
      return { state: result.state, payload: { bom: result.bom } };
    });
  });

  app.delete('/api/wms/boms/:bomId', (req, res) => {
    handleMutation(res, (cur) => {
      const result = deleteBomMaster(cur, req.params.bomId);
      return { state: result.state };
    });
  });

  app.post('/api/wms/packaging-specs', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addPackagingSpec(cur, req.body);
      return { state: result.state, payload: { spec: result.spec } };
    });
  });

  app.put('/api/wms/packaging-specs/:code', (req, res) => {
    handleMutation(res, (cur) => {
      const result = updatePackagingSpec(cur, req.params.code, req.body);
      return { state: result.state, payload: { spec: result.spec } };
    });
  });

  app.delete('/api/wms/packaging-specs/:code', (req, res) => {
    handleMutation(res, (cur) => {
      const result = deletePackagingSpec(cur, req.params.code);
      return { state: result.state };
    });
  });

  app.post('/api/wms/barcode-rules', (req, res) => {
    handleMutation(res, (cur) => {
      const result = saveBarcodeRule(cur, req.body);
      return { state: result.state, payload: { rule: result.rule } };
    });
  });

  app.delete('/api/wms/barcode-rules/:ruleId', (req, res) => {
    handleMutation(res, (cur) => {
      const result = deleteBarcodeRule(cur, req.params.ruleId);
      return { state: result.state };
    });
  });

  app.post('/api/wms/label-templates', (req, res) => {
    handleMutation(res, (cur) => {
      const result = saveLabelTemplate(cur, req.body);
      return { state: result.state, payload: { template: result.template } };
    });
  });

  app.delete('/api/wms/label-templates/:templateId', (req, res) => {
    handleMutation(res, (cur) => {
      const result = deleteLabelTemplate(cur, req.params.templateId);
      return { state: result.state };
    });
  });

  app.post('/api/wms/asns', (req, res) => {
    handleMutation(res, (cur) => {
      const result = createAsnOrder(cur, req.body);
      return { state: result.state, payload: { asn: result.asn } };
    });
  });

  app.post('/api/wms/asns/import-csv', (req, res) => {
    handleMutation(res, (cur) => {
      const result = importAsnFromCsv(cur, req.body);
      return { state: result.state, payload: { asn: result.asn } };
    });
  });

  app.post('/api/wms/asns/:asnNo/cancel', (req, res) => {
    handleMutation(res, (cur) => {
      const result = cancelAsnOrder(cur, req.params.asnNo);
      return { state: result.state, payload: { asn: result.asn } };
    });
  });

  app.put('/api/wms/printer-config', (req, res) => {
    handleMutation(res, (cur) => {
      const result = savePrinterConfig(cur, req.body);
      return { state: result.state, payload: { printerConfig: result.printerConfig } };
    });
  });

  app.post('/api/wms/print/zpl/test', async (req, res) => {
    const host = String(req.body?.host ?? '').trim();
    const port = Number(req.body?.port ?? 9100);
    if (!host) {
      res.status(400).json({ ok: false, error: 'Zebra 打印机 IP/主机名不能为空' });
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      res.status(400).json({ ok: false, error: '端口号必须为 1 - 65535 的整数' });
      return;
    }
    try {
      const result = await testZebraTcpConnection(host, port);
      res.json({ ok: true, payload: { host, port, latencyMs: result.latencyMs } });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Zebra 连通性测试失败',
      });
    }
  });

  app.post('/api/wms/print/zpl', async (req, res) => {
    const host = String(req.body?.host ?? '').trim();
    const port = Number(req.body?.port ?? 9100);
    const zpl = String(req.body?.zpl ?? '').trim();
    if (!host) {
      res.status(400).json({ ok: false, error: 'Zebra 打印机 IP/主机名不能为空' });
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      res.status(400).json({ ok: false, error: '端口号必须为 1 - 65535 的整数' });
      return;
    }
    if (!zpl || !zpl.includes('^XA') || !zpl.includes('^XZ')) {
      res.status(400).json({ ok: false, error: 'ZPL 指令格式无效，必须包含 ^XA 与 ^XZ 起止指令' });
      return;
    }
    try {
      const result = await sendZebraTcpZpl(host, port, zpl);
      res.json({ ok: true, payload: { host, port, bytesSent: result.bytesSent } });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'ZPL 下发失败',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`SMT WMS server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start WMS server:', err);
  process.exit(1);
});
