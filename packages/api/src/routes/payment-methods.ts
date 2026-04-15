import { Hono } from 'hono';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { paymentMethods, banks } from '../db/schema.js';

const paymentMethodsRouter = new Hono<AuthEnv>();

// GET / — List user's payment methods
paymentMethodsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('user').id;

  const rows = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), isNull(paymentMethods.deletedAt)))
    .orderBy(paymentMethods.isPrimary, paymentMethods.createdAt);

  // isPrimary DESC (true first), then createdAt DESC
  const sorted = rows.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return c.json({ success: true, data: sorted });
});

// GET /banks — List banks for autocomplete
paymentMethodsRouter.get('/banks', authMiddleware, async (c) => {
  const rows = await db.select().from(banks).orderBy(asc(banks.code));
  return c.json({ success: true, data: rows });
});

// POST / — Create payment method
paymentMethodsRouter.post('/', authMiddleware, async (c) => {
  const userId = c.get('user').id;
  const body = await c.req.json() as {
    methodType: 'pix' | 'ted';
    pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
    pixKey?: string;
    holderName?: string;
    holderDocType?: string;
    holderDocument?: string;
    bankCode?: string;
    bankName?: string;
    agency?: string;
    accountNumber?: string;
    accountType?: string;
  };

  if (!body.methodType) {
    return c.json({ success: false, error: 'Tipo de metodo obrigatorio' }, 400);
  }

  if (!body.holderName?.trim()) {
    return c.json({ success: false, error: 'Nome do titular obrigatorio' }, 400);
  }

  if (body.methodType === 'pix') {
    if (!body.pixKeyType) {
      return c.json({ success: false, error: 'Tipo de chave PIX obrigatorio' }, 400);
    }
    if (!body.pixKey?.trim()) {
      return c.json({ success: false, error: 'Chave PIX obrigatoria' }, 400);
    }
  }

  if (body.methodType === 'ted') {
    if (!body.bankCode?.trim()) {
      return c.json({ success: false, error: 'Codigo do banco obrigatorio' }, 400);
    }
    if (!body.agency?.trim()) {
      return c.json({ success: false, error: 'Agencia obrigatoria' }, 400);
    }
    if (!body.accountNumber?.trim()) {
      return c.json({ success: false, error: 'Numero da conta obrigatorio' }, 400);
    }
    if (!body.accountType?.trim()) {
      return c.json({ success: false, error: 'Tipo da conta obrigatorio' }, 400);
    }
    if (!body.holderDocType?.trim()) {
      return c.json({ success: false, error: 'Tipo de documento do titular obrigatorio' }, 400);
    }
    if (!body.holderDocument?.trim()) {
      return c.json({ success: false, error: 'Documento do titular obrigatorio' }, 400);
    }
  }

  // Check if user has any existing methods — auto-set primary if first
  const existing = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), isNull(paymentMethods.deletedAt)))
    .limit(1);

  const isPrimary = existing.length === 0;

  const [created] = await db
    .insert(paymentMethods)
    .values({
      userId,
      methodType: body.methodType,
      isPrimary,
      pixKeyType: body.methodType === 'pix' ? body.pixKeyType : null,
      pixKey: body.methodType === 'pix' ? body.pixKey?.trim() : null,
      holderName: body.holderName!.trim(),
      holderDocType: body.methodType === 'ted' ? body.holderDocType?.trim() : null,
      holderDocument: body.methodType === 'ted' ? body.holderDocument?.trim() : null,
      bankCode: body.methodType === 'ted' ? body.bankCode?.trim() : null,
      bankName: body.methodType === 'ted' ? body.bankName?.trim() : null,
      agency: body.methodType === 'ted' ? body.agency?.trim() : null,
      accountNumber: body.methodType === 'ted' ? body.accountNumber?.trim() : null,
      accountType: body.methodType === 'ted' ? body.accountType?.trim() : null,
    })
    .returning();

  return c.json({ success: true, data: created }, 201);
});

// PUT /:id — Update payment method
paymentMethodsRouter.put('/:id', authMiddleware, async (c) => {
  const userId = c.get('user').id;
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const [existing] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId), isNull(paymentMethods.deletedAt)))
    .limit(1);

  if (!existing) {
    return c.json({ success: false, error: 'Metodo de pagamento nao encontrado' }, 404);
  }

  const body = await c.req.json() as {
    pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
    pixKey?: string;
    holderName?: string;
    holderDocType?: string;
    holderDocument?: string;
    bankCode?: string;
    bankName?: string;
    agency?: string;
    accountNumber?: string;
    accountType?: string;
  };

  if (!body.holderName?.trim()) {
    return c.json({ success: false, error: 'Nome do titular obrigatorio' }, 400);
  }

  if (existing.methodType === 'pix') {
    if (!body.pixKeyType) {
      return c.json({ success: false, error: 'Tipo de chave PIX obrigatorio' }, 400);
    }
    if (!body.pixKey?.trim()) {
      return c.json({ success: false, error: 'Chave PIX obrigatoria' }, 400);
    }
  }

  if (existing.methodType === 'ted') {
    if (!body.bankCode?.trim()) {
      return c.json({ success: false, error: 'Codigo do banco obrigatorio' }, 400);
    }
    if (!body.agency?.trim()) {
      return c.json({ success: false, error: 'Agencia obrigatoria' }, 400);
    }
    if (!body.accountNumber?.trim()) {
      return c.json({ success: false, error: 'Numero da conta obrigatorio' }, 400);
    }
    if (!body.accountType?.trim()) {
      return c.json({ success: false, error: 'Tipo da conta obrigatorio' }, 400);
    }
    if (!body.holderDocType?.trim()) {
      return c.json({ success: false, error: 'Tipo de documento do titular obrigatorio' }, 400);
    }
    if (!body.holderDocument?.trim()) {
      return c.json({ success: false, error: 'Documento do titular obrigatorio' }, 400);
    }
  }

  const updateData: Record<string, unknown> = {
    holderName: body.holderName!.trim(),
    updatedAt: new Date(),
  };

  if (existing.methodType === 'pix') {
    updateData.pixKeyType = body.pixKeyType;
    updateData.pixKey = body.pixKey?.trim();
  } else {
    updateData.holderDocType = body.holderDocType?.trim();
    updateData.holderDocument = body.holderDocument?.trim();
    updateData.bankCode = body.bankCode?.trim();
    updateData.bankName = body.bankName?.trim();
    updateData.agency = body.agency?.trim();
    updateData.accountNumber = body.accountNumber?.trim();
    updateData.accountType = body.accountType?.trim();
  }

  const [updated] = await db
    .update(paymentMethods)
    .set(updateData)
    .where(eq(paymentMethods.id, id))
    .returning();

  return c.json({ success: true, data: updated });
});

// DELETE /:id — Soft delete
paymentMethodsRouter.delete('/:id', authMiddleware, async (c) => {
  const userId = c.get('user').id;
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const [existing] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId), isNull(paymentMethods.deletedAt)))
    .limit(1);

  if (!existing) {
    return c.json({ success: false, error: 'Metodo de pagamento nao encontrado' }, 404);
  }

  await db
    .update(paymentMethods)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(paymentMethods.id, id));

  // If deleted method was primary, promote the oldest remaining
  if (existing.isPrimary) {
    const [next] = await db
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(and(eq(paymentMethods.userId, userId), isNull(paymentMethods.deletedAt)))
      .orderBy(asc(paymentMethods.createdAt))
      .limit(1);

    if (next) {
      await db
        .update(paymentMethods)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(paymentMethods.id, next.id));
    }
  }

  return c.json({ success: true, data: { deleted: true } });
});

// PATCH /:id/primary — Set as primary
paymentMethodsRouter.patch('/:id/primary', authMiddleware, async (c) => {
  const userId = c.get('user').id;
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const [target] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId), isNull(paymentMethods.deletedAt)))
    .limit(1);

  if (!target) {
    return c.json({ success: false, error: 'Metodo de pagamento nao encontrado' }, 404);
  }

  // Clear all primary flags for this user, then set the target
  await db
    .update(paymentMethods)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(eq(paymentMethods.userId, userId), isNull(paymentMethods.deletedAt)));

  const [updated] = await db
    .update(paymentMethods)
    .set({ isPrimary: true, updatedAt: new Date() })
    .where(eq(paymentMethods.id, id))
    .returning();

  return c.json({ success: true, data: updated });
});

export { paymentMethodsRouter };
