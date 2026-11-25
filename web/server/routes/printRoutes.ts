import { Router } from 'express';
import { requireRoles } from '../middleware/auth.ts';
import { sendZebraTcpZpl, testZebraTcpConnection } from '../services/zebraTcpPrinter.ts';

export function createPrintRouter(): Router {
  const router = Router();
  const requireWarehouseOrProduction = requireRoles('WAREHOUSE', 'PRODUCTION', 'ADMIN');

  router.post('/zpl/test', requireWarehouseOrProduction, async (req, res) => {
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

  router.post('/zpl', requireWarehouseOrProduction, async (req, res) => {
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

  return router;
}
