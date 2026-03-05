import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { appointmentOverrides, appointmentsMirror } from '../db/schema.js';
import { externalApi } from '../services/external-api.js';

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
// Quando isExcluded=true: cancela na API PHP externa ANTES de salvar override local.
// Se API PHP retornar 404 (appointment nao existe la), continua com override local.
// Se API PHP retornar outro erro, retorna 502 para o cliente.
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

  // Se estamos excluindo (nao restaurando), cancela na API PHP externa
  if (body.isExcluded) {
    try {
      await externalApi.cancelAppointment(body.externalAppointmentId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[overrides/exclude] Falha ao cancelar na API PHP: ${message}`);
      return c.json({ success: false, error: `Falha ao cancelar atendimento na API principal: ${message}` }, 502);
    }
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

  // Atualizar mirror local (deletar appointment excluido)
  if (body.isExcluded) {
    await db.delete(appointmentsMirror).where(
      and(
        eq(appointmentsMirror.externalId, body.externalAppointmentId),
        eq(appointmentsMirror.professionalId, body.professionalId),
      )
    ).catch(() => { /* mirror pode nao existir ainda */ });
  }

  return c.json({ success: true, data: formatOverride(row!) });
});

export { overridesRouter };
