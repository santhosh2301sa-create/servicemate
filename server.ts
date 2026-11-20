import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { getDb, runMigrations } from './src/db/database.ts';
import { seedDatabase } from './src/db/seed.ts';
import authRoutes from './src/server/routes/authRoutes.ts';
import marketplaceRoutes from './src/server/routes/marketplaceRoutes.ts';
import bookingRoutes from './src/server/routes/bookingRoutes.ts';
import providerRoutes from './src/server/routes/providerRoutes.ts';
import adminRoutes from './src/server/routes/adminRoutes.ts';

async function startServer() {
  // Initialize SQLite schema & seed fictional sample data if database is empty
  const db = getDb();
  runMigrations(db);
  seedDatabase();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ServiceMate API' });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api', marketplaceRoutes);
  app.use('/api', bookingRoutes);
  app.use('/api/provider', providerRoutes);
  app.use('/api/admin', adminRoutes);

  // Unknown API routes return JSON 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`ServiceMate server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ServiceMate server:', err);
  process.exit(1);
});
