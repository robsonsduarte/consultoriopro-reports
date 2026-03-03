import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { users } from './schema.js';

const connectionString = process.env.DATABASE_URL
  ?? 'postgresql://robsonduarte@localhost:5433/cpro_reports';

const client = postgres(connectionString);
const db = drizzle(client);

const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function seed() {
  console.log('Seeding database...');

  // Admin user
  await db.insert(users).values({
    name: 'Admin',
    email: 'admin@consultoriopro.com',
    passwordHash: await hashPassword('admin123'),
    role: 'super_admin',
    isActive: true,
    mustChangePassword: false,
  }).onConflictDoNothing();

  // Professional user (test)
  await db.insert(users).values({
    name: 'Dr. Teste',
    email: 'dr.teste@consultoriopro.com',
    passwordHash: await hashPassword('teste123'),
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
