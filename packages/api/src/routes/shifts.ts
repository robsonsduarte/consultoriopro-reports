import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { externalApi } from '../services/external-api.js';
import { db } from '../db/index.js';
import { shifts, professionalConfig } from '../db/schema.js';

const shiftsRouter = new Hono<AuthEnv>();

function formatShift(s: typeof shifts.$inferSelect) {
  return {
    id: s.id,
    professionalId: s.professionalId,
    month: s.month,
    dayOfWeek: s.dayOfWeek,
    period: s.period,
    modality: s.modality,
    shiftValue: Number(s.shiftValue),
    origin: s.origin,
    createdAt: s.createdAt.toISOString(),
  };
}

// GET /shifts/:professionalId?month=YYYY-MM
shiftsRouter.get('/:professionalId', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const professionalId = Number(c.req.param('professionalId'));
  const month = c.req.query('month');

  if (!professionalId || isNaN(professionalId)) {
    return c.json({ success: false, error: 'professionalId invalido' }, 400);
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'Query param month obrigatorio (YYYY-MM)' }, 400);
  }

  const rows = await db
    .select()
    .from(shifts)
    .where(and(
      eq(shifts.professionalId, professionalId),
      eq(shifts.month, month),
    ))
    .orderBy(shifts.dayOfWeek, shifts.period);

  return c.json({ success: true, data: rows.map(formatShift) });
});

// POST /shifts — cria turno manual
shiftsRouter.post('/', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const body = await c.req.json() as {
    professionalId: number;
    month: string;
    dayOfWeek: number;
    period: 'morning' | 'afternoon' | 'evening';
    modality: 'presencial' | 'online';
    shiftValue: number;
  };

  if (!body.professionalId || !body.month || !body.dayOfWeek || !body.period || !body.modality || body.shiftValue == null) {
    return c.json({ success: false, error: 'Campos obrigatorios: professionalId, month, dayOfWeek, period, modality, shiftValue' }, 400);
  }

  if (body.dayOfWeek < 1 || body.dayOfWeek > 6) {
    return c.json({ success: false, error: 'dayOfWeek deve ser entre 1 (Seg) e 6 (Sab)' }, 400);
  }

  const rows = await db
    .insert(shifts)
    .values({
      professionalId: body.professionalId,
      month: body.month,
      dayOfWeek: body.dayOfWeek,
      period: body.period,
      modality: body.modality,
      shiftValue: String(body.shiftValue),
      origin: 'manual',
    })
    .returning();

  return c.json({ success: true, data: formatShift(rows[0]!) }, 201);
});

// PUT /shifts/:id — atualiza turno
shiftsRouter.put('/:id', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const body = await c.req.json() as {
    dayOfWeek?: number;
    period?: 'morning' | 'afternoon' | 'evening';
    modality?: 'presencial' | 'online';
    shiftValue?: number;
  };

  if (body.dayOfWeek !== undefined && (body.dayOfWeek < 1 || body.dayOfWeek > 6)) {
    return c.json({ success: false, error: 'dayOfWeek deve ser entre 1 (Seg) e 6 (Sab)' }, 400);
  }

  const updateData: Record<string, unknown> = {};
  if (body.dayOfWeek !== undefined) updateData.dayOfWeek = body.dayOfWeek;
  if (body.period !== undefined) updateData.period = body.period;
  if (body.modality !== undefined) updateData.modality = body.modality;
  if (body.shiftValue !== undefined) updateData.shiftValue = String(body.shiftValue);

  if (Object.keys(updateData).length === 0) {
    return c.json({ success: false, error: 'Nenhum campo para atualizar' }, 400);
  }

  const [updated] = await db
    .update(shifts)
    .set(updateData)
    .where(eq(shifts.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: 'Turno nao encontrado' }, 404);
  }

  return c.json({ success: true, data: formatShift(updated) });
});

// DELETE /shifts/:id
shiftsRouter.delete('/:id', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const [deleted] = await db
    .delete(shifts)
    .where(eq(shifts.id, id))
    .returning();

  if (!deleted) {
    return c.json({ success: false, error: 'Turno nao encontrado' }, 404);
  }

  return c.json({ success: true, data: { deleted: true } });
});

// POST /shifts/infer — infere turnos a partir dos atendimentos
shiftsRouter.post('/infer', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const body = await c.req.json() as { professionalId: number; month: string };

  if (!body.professionalId || !body.month) {
    return c.json({ success: false, error: 'Campos obrigatorios: professionalId, month' }, 400);
  }

  // Get appointments from external API
  const report = await externalApi.getReport(body.professionalId, body.month);

  // Get shift values from config (professional-specific or global)
  const configRows = await db
    .select()
    .from(professionalConfig)
    .where(eq(professionalConfig.professionalId, body.professionalId));

  const globalConfigRows = await db
    .select()
    .from(professionalConfig)
    .where(eq(professionalConfig.professionalId, 0));

  function getConfigValue(key: string): number | null {
    const profConfig = configRows.find((r) => r.key === key);
    if (profConfig) return Number(profConfig.value);
    const global = globalConfigRows.find((r) => r.key === key);
    if (global) return Number(global.value);
    return null;
  }

  const shiftValues = {
    presencial: getConfigValue('shift_presencial') ?? 850,
    online: getConfigValue('shift_online') ?? 650,
  };

  // Analyze appointments to identify consistent work patterns
  // Rule: a shift (dow+period) is valid only if the professional had >= 3
  // appointments in that period on ALL occurrences of that weekday in the month
  const MIN_APPTS_PER_DAY = 3;

  // Step 1: Count appointments per specific date + period
  // Key: "date|dow-period", e.g. "2026-03-02|1-afternoon"
  const dateApptCounts = new Map<string, number>();
  const dateToDowPeriod = new Map<string, string>();

  for (const appt of report.appointments) {
    const date = new Date(appt.date + 'T12:00:00');
    const dow = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (dow === 0) continue; // Skip sunday

    let period: 'morning' | 'afternoon' = 'morning';
    if (appt.time) {
      const hour = parseInt(appt.time.split(':')[0]!, 10);
      if (hour >= 12) period = 'afternoon';
    }

    const dowPeriod = `${dow}-${period}`;
    const dateKey = `${appt.date}|${dowPeriod}`;
    dateApptCounts.set(dateKey, (dateApptCounts.get(dateKey) ?? 0) + 1);
    dateToDowPeriod.set(dateKey, dowPeriod);
  }

  // Step 2: Calculate all weekday occurrences in the month
  const [yearStr, monStr] = body.month.split('-');
  const year = Number(yearStr);
  const mon = Number(monStr);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const weekdayOccurrences = new Map<number, number>(); // dow -> count of weeks
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, mon - 1, d).getDay();
    if (dow === 0) continue;
    weekdayOccurrences.set(dow, (weekdayOccurrences.get(dow) ?? 0) + 1);
  }

  // Step 3: For each dow+period, count weeks with >= MIN_APPTS_PER_DAY
  const qualifyingWeeks = new Map<string, number>();
  for (const [dateKey, count] of dateApptCounts) {
    const dowPeriod = dateToDowPeriod.get(dateKey)!;
    if (count >= MIN_APPTS_PER_DAY) {
      qualifyingWeeks.set(dowPeriod, (qualifyingWeeks.get(dowPeriod) ?? 0) + 1);
    }
  }

  // Step 4: Shift is valid if >= 3 weeks of that weekday qualified
  const MIN_QUALIFYING_WEEKS = 3;
  const dayPeriodSet = new Set<string>();
  for (const [dowPeriod, weeks] of qualifyingWeeks) {
    if (weeks >= MIN_QUALIFYING_WEEKS) {
      dayPeriodSet.add(dowPeriod);
    }
  }

  // Remove previously inferred shifts (keep manual ones)
  await db
    .delete(shifts)
    .where(and(
      eq(shifts.professionalId, body.professionalId),
      eq(shifts.month, body.month),
      eq(shifts.origin, 'inferred'),
    ));

  // Check remaining manual shifts to avoid duplicates
  const manualShifts = await db
    .select()
    .from(shifts)
    .where(and(
      eq(shifts.professionalId, body.professionalId),
      eq(shifts.month, body.month),
    ));

  const manualKeys = new Set(
    manualShifts.map((s) => `${s.dayOfWeek}-${s.period}`)
  );

  // Create new shifts only for patterns not covered by manual shifts
  const newShifts: Array<typeof shifts.$inferInsert> = [];

  for (const key of dayPeriodSet) {
    if (manualKeys.has(key)) continue;

    const [dowStr, period] = key.split('-');
    const dayOfWeek = Number(dowStr);

    newShifts.push({
      professionalId: body.professionalId,
      month: body.month,
      dayOfWeek,
      period: period as 'morning' | 'afternoon' | 'evening',
      modality: 'presencial',
      shiftValue: String(shiftValues.presencial),
      origin: 'inferred',
    });
  }

  let created: Array<typeof shifts.$inferSelect> = [];
  if (newShifts.length > 0) {
    created = await db
      .insert(shifts)
      .values(newShifts)
      .returning();
  }

  return c.json({
    success: true,
    data: {
      created: created.length,
      shifts: created.map(formatShift),
    },
  });
});

export { shiftsRouter };
