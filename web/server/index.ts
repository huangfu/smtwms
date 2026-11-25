import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createAdminUserRouter } from './routes/adminUserRoutes.ts';
import { createAuthRouter } from './routes/authRoutes.ts';
import { createWmsRouter } from './routes/wmsRoutes.ts';

export async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Modularized backend REST APIs
  app.use('/api/auth', createAuthRouter());
  app.use('/api/admin/users', createAdminUserRouter());
  app.use('/api/wms', createWmsRouter());

  // Frontend static hosting (production) or Vite middleware (development)
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
