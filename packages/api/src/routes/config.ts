import { Hono } from 'hono';
import { eq, and, like } from 'drizzle-orm';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { professionalConfig } from '../db/schema.js';

const configRouter = new Hono<AuthEnv>();

// GET /config/global — Get global config (professionalId=0)
configRouter.get('/global', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const rows = await db
    .select()
    .from(professionalConfig)
    .where(eq(professionalConfig.professionalId, 0));

  const configMap = new Map(rows.map((r) => [r.key, r.value]));

  const data = {
    taxRate: configMap.get('tax_rate') ?? null,
    shiftPresencial: configMap.get('shift_presencial') ?? null,
    shiftOnline: configMap.get('shift_online') ?? null,
  };

  return c.json({ success: true, data });
});

// PUT /config/global — Update global config
configRouter.put('/global', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const body = await c.req.json() as {
    taxRate?: string;
    shiftPresencial?: string;
    shiftOnline?: string;
  };

  const keyMap: Record<string, string | undefined> = {
    tax_rate: body.taxRate,
    shift_presencial: body.shiftPresencial,
    shift_online: body.shiftOnline,
  };

  for (const [key, value] of Object.entries(keyMap)) {
    if (value === undefined) continue;

    await db
      .insert(professionalConfig)
      .values({
        professionalId: 0,
        key,
        value: String(value),
      })
      .onConflictDoUpdate({
        target: [professionalConfig.professionalId, professionalConfig.key],
        set: { value: String(value), updatedAt: new Date() },
      });
  }

  // Return updated config
  const rows = await db
    .select()
    .from(professionalConfig)
    .where(eq(professionalConfig.professionalId, 0));

  const configMap = new Map(rows.map((r) => [r.key, r.value]));

  return c.json({
    success: true,
    data: {
      taxRate: configMap.get('tax_rate') ?? null,
      shiftPresencial: configMap.get('shift_presencial') ?? null,
      shiftOnline: configMap.get('shift_online') ?? null,
    },
  });
});

// GET /config/professional/:professionalId — Get professional config
configRouter.get('/professional/:professionalId', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const professionalId = Number(c.req.param('professionalId'));
  if (!professionalId || isNaN(professionalId)) {
    return c.json({ success: false, error: 'professionalId invalido' }, 400);
  }

  const rows = await db
    .select()
    .from(professionalConfig)
    .where(eq(professionalConfig.professionalId, professionalId));

  const configMap = new Map(rows.map((r) => [r.key, r.value]));

  // Extract operator_ keys
  const operators: Array<{ name: string; value: string }> = [];
  for (const [key, value] of configMap) {
    if (key.startsWith('operator_')) {
      operators.push({ name: key.replace('operator_', ''), value });
    }
  }

  const data = {
    professionalId,
    taxRate: configMap.get('tax_rate') ?? null,
    shiftPresencial: configMap.get('shift_presencial') ?? null,
    shiftOnline: configMap.get('shift_online') ?? null,
    operators,
  };

  return c.json({ success: true, data });
});

// PUT /config/professional/:professionalId — Update professional config
configRouter.put('/professional/:professionalId', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const professionalId = Number(c.req.param('professionalId'));
  if (!professionalId || isNaN(professionalId)) {
    return c.json({ success: false, error: 'professionalId invalido' }, 400);
  }

  const body = await c.req.json() as {
    taxRate?: string;
    shiftPresencial?: string;
    shiftOnline?: string;
    operators?: Array<{ name: string; value: string }>;
  };

  // Upsert numeric config keys
  const keyMap: Record<string, string | undefined> = {
    tax_rate: body.taxRate,
    shift_presencial: body.shiftPresencial,
    shift_online: body.shiftOnline,
  };

  for (const [key, value] of Object.entries(keyMap)) {
    if (value === undefined) continue;

    await db
      .insert(professionalConfig)
      .values({
        professionalId,
        key,
        value: String(value),
      })
      .onConflictDoUpdate({
        target: [professionalConfig.professionalId, professionalConfig.key],
        set: { value: String(value), updatedAt: new Date() },
      });
  }

  // Handle operators: delete all existing operator_ keys, then insert new
  if (body.operators !== undefined) {
    // Get all operator_ keys for this professional
    const existingOperators = await db
      .select()
      .from(professionalConfig)
      .where(
        and(
          eq(professionalConfig.professionalId, professionalId),
          like(professionalConfig.key, 'operator_%'),
        )
      );

    // Delete existing operator keys
    for (const row of existingOperators) {
      await db
        .delete(professionalConfig)
        .where(eq(professionalConfig.id, row.id));
    }

    // Insert new operator keys
    for (const op of body.operators) {
      await db
        .insert(professionalConfig)
        .values({
          professionalId,
          key: `operator_${op.name}`,
          value: String(op.value),
        });
    }
  }

  // Return updated config
  const rows = await db
    .select()
    .from(professionalConfig)
    .where(eq(professionalConfig.professionalId, professionalId));

  const configMap = new Map(rows.map((r) => [r.key, r.value]));

  const operators: Array<{ name: string; value: string }> = [];
  for (const [key, value] of configMap) {
    if (key.startsWith('operator_')) {
      operators.push({ name: key.replace('operator_', ''), value });
    }
  }

  return c.json({
    success: true,
    data: {
      professionalId,
      taxRate: configMap.get('tax_rate') ?? null,
      shiftPresencial: configMap.get('shift_presencial') ?? null,
      shiftOnline: configMap.get('shift_online') ?? null,
      operators,
    },
  });
});

export { configRouter };
