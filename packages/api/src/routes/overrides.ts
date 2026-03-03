import { Hono } from 'hono';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { appointmentOverrides } from '../db/schema.js';

function formatOverride(o: typeof appointmentOverrides.$inferSelect) {
  return {
    id: o.id,
    externalAppointmentId: o.externalAppointmentId,
    professionalId: o.professionalId,
    month: o.month,
    isPaid: o.isPaid,
    isExcluded: o.isExcluded,
    updatedAt: o.updatedAt.toISOString(),
  };
}

const overridesRouter = new Hono<AuthEnv>();

// PATCH /overrides/toggle-paid — Toggle isPaid for an appointment
overridesRouter.patch('/toggle-paid', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const body = await c.req.json() as {
    externalAppointmentId: number;
    professionalId: number;
    month: string;
    isPaid: boolean;
  };

  if (!body.externalAppointmentId || !body.professionalId || !body.month) {
    return c.json({ success: false, error: 'Campos obrigatorios: externalAppointmentId, professionalId, month' }, 400);
  }

  if (typeof body.isPaid !== 'boolean') {
    return c.json({ success: false, error: 'isPaid deve ser boolean' }, 400);
  }

  const [row] = await db
    .insert(appointmentOverrides)
    .values({
      externalAppointmentId: body.externalAppointmentId,
      professionalId: body.professionalId,
      month: body.month,
      isPaid: body.isPaid,
    })
    .onConflictDoUpdate({
      target: [appointmentOverrides.externalAppointmentId, appointmentOverrides.professionalId],
      set: {
        isPaid: body.isPaid,
        month: body.month,
        updatedAt: new Date(),
      },
    })
    .returning();

  return c.json({ success: true, data: formatOverride(row!) });
});

// PATCH /overrides/exclude — Exclude/include an appointment
overridesRouter.patch('/exclude', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const body = await c.req.json() as {
    externalAppointmentId: number;
    professionalId: number;
    month: string;
    isExcluded: boolean;
  };

  if (!body.externalAppointmentId || !body.professionalId || !body.month) {
    return c.json({ success: false, error: 'Campos obrigatorios: externalAppointmentId, professionalId, month' }, 400);
  }

  if (typeof body.isExcluded !== 'boolean') {
    return c.json({ success: false, error: 'isExcluded deve ser boolean' }, 400);
  }

  const [row] = await db
    .insert(appointmentOverrides)
    .values({
      externalAppointmentId: body.externalAppointmentId,
      professionalId: body.professionalId,
      month: body.month,
      isExcluded: body.isExcluded,
    })
    .onConflictDoUpdate({
      target: [appointmentOverrides.externalAppointmentId, appointmentOverrides.professionalId],
      set: {
        isExcluded: body.isExcluded,
        month: body.month,
        updatedAt: new Date(),
      },
    })
    .returning();

  return c.json({ success: true, data: formatOverride(row!) });
});

export { overridesRouter };
