import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'admin', 'user']);
export const releaseStatusEnum = pgEnum('release_status', [
  'pending', 'approved', 'contested', 'in_review', 'resolved',
]);
export const shiftPeriodEnum = pgEnum('shift_period', ['morning', 'afternoon', 'evening']);
export const shiftModalityEnum = pgEnum('shift_modality', ['presencial', 'online']);
export const paymentMethodTypeEnum = pgEnum('payment_method_type', ['pix', 'ted']);
export const pixKeyTypeEnum = pgEnum('pix_key_type', ['cpf', 'cnpj', 'email', 'phone', 'random']);

// Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  apiProfessionalId: integer('api_professional_id'),
  isActive: boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  resetToken: varchar('reset_token', { length: 64 }),
  resetTokenExpiresAt: timestamp('reset_token_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Report Releases
export const reportReleases = pgTable('report_releases', {
  id: serial('id').primaryKey(),
  professionalId: integer('professional_id').notNull(),
  month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
  status: releaseStatusEnum('status').notNull().default('pending'),
  releasedBy: integer('released_by').notNull().references(() => users.id),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  isPaid: boolean('is_paid').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_release_professional_month').on(t.professionalId, t.month),
]);

// Contestation Messages
export const contestationMessages = pgTable('contestation_messages', {
  id: serial('id').primaryKey(),
  releaseId: integer('release_id').notNull().references(() => reportReleases.id),
  userId: integer('user_id').notNull().references(() => users.id),
  message: text('message').notNull(),
  readByUserIds: integer('read_by_user_ids').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Shifts
// NOTA: professionalId aqui referencia o apiProfessionalId da API externa,
// NAO o users.id local. Usar JOIN users.apiProfessionalId para vincular.
export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  professionalId: integer('professional_id').notNull(), // apiProfessionalId (API externa)
  month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
  dayOfWeek: integer('day_of_week').notNull(), // 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  period: shiftPeriodEnum('period').notNull(),
  modality: shiftModalityEnum('modality').notNull(),
  shiftValue: numeric('shift_value', { precision: 10, scale: 2 }).notNull(),
  origin: varchar('origin', { length: 50 }).notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_shifts_professional_month').on(t.professionalId, t.month),
]);

// Payment Methods
export const paymentMethods = pgTable('payment_methods', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  methodType: paymentMethodTypeEnum('method_type').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  // PIX fields
  pixKeyType: pixKeyTypeEnum('pix_key_type'),
  pixKey: varchar('pix_key', { length: 255 }),
  holderName: varchar('holder_name', { length: 255 }),
  // TED fields
  holderDocType: varchar('holder_doc_type', { length: 10 }),
  holderDocument: varchar('holder_document', { length: 20 }),
  bankCode: varchar('bank_code', { length: 10 }),
  bankName: varchar('bank_name', { length: 255 }),
  agency: varchar('agency', { length: 20 }),
  accountNumber: varchar('account_number', { length: 30 }),
  accountType: varchar('account_type', { length: 20 }),
  // Meta
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Professional Config (professionalId=0 para config global)
export const professionalConfig = pgTable('professional_config', {
  id: serial('id').primaryKey(),
  professionalId: integer('professional_id').notNull().default(0), // 0 = global
  key: varchar('key', { length: 100 }).notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_config_professional_key').on(t.professionalId, t.key),
]);

// Banks (reference data)
export const banks = pgTable('banks', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
});

// Report Snapshots (cache de dados da API externa)
export const reportSnapshots = pgTable('report_snapshots', {
  id: serial('id').primaryKey(),
  professionalId: integer('professional_id').notNull(),
  month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
  data: text('data').notNull(), // JSON stringified (appointments, operators, summary)
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_snapshot_professional_month').on(t.professionalId, t.month),
]);

// Appointment Overrides (flags locais sobre atendimentos da API externa)
export const appointmentOverrides = pgTable('appointment_overrides', {
  id: serial('id').primaryKey(),
  externalAppointmentId: integer('external_appointment_id').notNull(),
  professionalId: integer('professional_id').notNull(),
  month: varchar('month', { length: 7 }).notNull(),
  isPaid: boolean('is_paid'),
  isExcluded: boolean('is_excluded').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_override_appointment').on(t.externalAppointmentId, t.professionalId),
]);

// Audit Log
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Sync / Mirror Tables ---

export const syncStatusEnum = pgEnum('sync_entity_status', ['idle', 'running', 'error']);

export const professionalsMirror = pgTable('professionals_mirror', {
  id: serial('id').primaryKey(),
  externalId: integer('external_id').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  specialty: varchar('specialty', { length: 255 }).notNull().default('Geral'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appointmentsMirror = pgTable('appointments_mirror', {
  id: serial('id').primaryKey(),
  externalId: integer('external_id').notNull(),
  professionalId: integer('professional_id').notNull(),
  month: varchar('month', { length: 7 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(),
  time: varchar('time', { length: 8 }).notNull().default(''),
  patientName: varchar('patient_name', { length: 255 }).notNull(),
  operatorName: varchar('operator_name', { length: 255 }).notNull().default(''),
  value: numeric('value', { precision: 10, scale: 2 }).notNull().default('0'),
  guideNumber: varchar('guide_number', { length: 100 }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_appt_mirror_external').on(t.externalId, t.professionalId),
  index('idx_appt_mirror_prof_month').on(t.professionalId, t.month),
]);

export const reportSummaryMirror = pgTable('report_summary_mirror', {
  id: serial('id').primaryKey(),
  professionalId: integer('professional_id').notNull(),
  month: varchar('month', { length: 7 }).notNull(),
  revenue: numeric('revenue', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  tax: numeric('tax', { precision: 12, scale: 2 }).notNull().default('0'),
  netValue: numeric('net_value', { precision: 12, scale: 2 }).notNull().default('0'),
  totalAppointments: integer('total_appointments').notNull().default(0),
  operatorsSummary: text('operators_summary').notNull().default('[]'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_summary_mirror_prof_month').on(t.professionalId, t.month),
]);

export const syncLog = pgTable('sync_log', {
  id: serial('id').primaryKey(),
  entity: varchar('entity', { length: 50 }).notNull(),
  professionalId: integer('professional_id'),
  month: varchar('month', { length: 7 }),
  status: syncStatusEnum('status').notNull().default('idle'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  errorCount: integer('error_count').notNull().default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('uq_sync_log_entity').on(t.entity, t.professionalId, t.month),
]);
