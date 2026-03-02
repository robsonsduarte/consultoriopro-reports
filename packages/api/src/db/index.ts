import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL
  ?? 'postgresql://robsonduarte@localhost:5433/cpro_reports';

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
