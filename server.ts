import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createSeedData } from './src/data/seedData';
import type { WmsState } from './src/types/wms';
import {
  addCustomer,
  addMaterialSku,
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
  importAsnFromCsv,
  issueWaveAllocation,
  normalizeWmsState,
  saveBomMaster,
} from './src/utils/wmsLogic';

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

  app.post('/api/wms/bins', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addWarehouseBin(cur, req.body);
      return { state: result.state, payload: { bin: result.bin } };
    });
  });

  app.post('/api/wms/keepers', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addWarehouseKeeper(cur, req.body);
      return { state: result.state, payload: { keeper: result.keeper } };
    });
  });

  app.post('/api/wms/suppliers', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addSupplier(cur, req.body);
      return { state: result.state, payload: { supplier: result.supplier } };
    });
  });

  app.post('/api/wms/customers', (req, res) => {
    handleMutation(res, (cur) => {
      const result = addCustomer(cur, req.body);
      return { state: result.state, payload: { customer: result.customer } };
    });
  });

  app.post('/api/wms/boms', (req, res) => {
    handleMutation(res, (cur) => {
      const result = saveBomMaster(cur, req.body);
      return { state: result.state, payload: { bom: result.bom } };
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
