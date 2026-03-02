import { Hono } from 'hono';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

const health = new Hono();

health.get('/', async (c) => {
  try {
    const result = await db.execute(sql`SELECT 1 AS ok`);
    return c.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

export { health };
