import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  date,
  pgEnum,
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
});

// Contestation Messages
export const contestationMessages = pgTable('contestation_messages', {
  id: serial('id').primaryKey(),
  releaseId: integer('release_id').notNull().references(() => reportReleases.id),
  userId: integer('user_id').notNull().references(() => users.id),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Shifts
export const shifts = pgTable('shifts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
  dayOfWeek: integer('day_of_week').notNull(), // 0-6
  period: shiftPeriodEnum('period').notNull(),
  modality: shiftModalityEnum('modality').notNull(),
  shiftValue: numeric('shift_value', { precision: 10, scale: 2 }).notNull(),
  origin: varchar('origin', { length: 50 }).notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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

// Professional Config
export const professionalConfig = pgTable('professional_config', {
  id: serial('id').primaryKey(),
  professionalId: integer('professional_id').notNull(),
  key: varchar('key', { length: 100 }).notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Banks (reference data)
export const banks = pgTable('banks', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
});

// Audit Log
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
