import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { health } from './routes/health.js';
import { auth } from './routes/auth.js';
import { professionals } from './routes/professionals.js';
import { dashboard } from './routes/dashboard.js';
import { report } from './routes/report.js';
import { shiftsRouter } from './routes/shifts.js';
import { usersRouter } from './routes/users.js';
import { configRouter } from './routes/config.js';
import { releasesRouter } from './routes/releases.js';
import { overridesRouter } from './routes/overrides.js';
import { notifications } from './routes/notifications.js';
import { syncRouter } from './routes/sync.js';
import { startSyncScheduler } from './services/sync-scheduler.js';

const app = new Hono();

// Middleware global
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Routes
app.route('/health', health);
app.route('/auth', auth);
app.route('/professionals', professionals);
app.route('/dashboard', dashboard);
app.route('/report', report);
app.route('/shifts', shiftsRouter);
app.route('/users', usersRouter);
app.route('/config', configRouter);
app.route('/releases', releasesRouter);
app.route('/overrides', overridesRouter);
app.route('/notifications', notifications);
app.route('/sync', syncRouter);

// 404
app.notFound((c) => c.json({ success: false, error: 'Rota nao encontrada' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ success: false, error: 'Erro interno do servidor' }, 500);
});

const port = Number(process.env.API_PORT) || 3001;

console.log(`[cpro-api] Servidor rodando em http://localhost:${port}`);

serve({ fetch: app.fetch, port });

// Inicia scheduler de sincronizacao automatica
startSyncScheduler();
