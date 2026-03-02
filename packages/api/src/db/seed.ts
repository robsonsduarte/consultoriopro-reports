import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './schema.js';
import { createHash } from 'node:crypto';

const connectionString = process.env.DATABASE_URL
  ?? 'postgresql://robsonduarte@localhost:5433/cpro_reports';

const client = postgres(connectionString);
const db = drizzle(client);

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function seed() {
  console.log('Seeding database...');

  // Admin user
  await db.insert(users).values({
    name: 'Admin',
    email: 'admin@consultoriopro.com',
    passwordHash: hashPassword('admin123'),
    role: 'super_admin',
    isActive: true,
    mustChangePassword: false,
  }).onConflictDoNothing();

  // Professional user (test)
  await db.insert(users).values({
    name: 'Dr. Teste',
    email: 'dr.teste@consultoriopro.com',
    passwordHash: hashPassword('teste123'),
    role: 'user',
    apiProfessionalId: 1,
    isActive: true,
    mustChangePassword: false,
  }).onConflictDoNothing();

  console.log('Seed completo!');
  console.log('  admin@consultoriopro.com / admin123 (super_admin)');
  console.log('  dr.teste@consultoriopro.com / teste123 (user)');

  await client.end();
}

seed().catch(console.error);
