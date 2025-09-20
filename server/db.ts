import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use DATABASE_URL for Supabase connection
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Parse connection string for Supabase with proper SSL
function parseConnectionString(connectionString: string) {
  // For Supabase, use the connection string directly with proper SSL
  return {
    connectionString: connectionString + (connectionString.includes('?') ? '&' : '?') + 'sslmode=require',
  };
}

const poolConfig = parseConnectionString(databaseUrl);
console.log('Pool config type:', poolConfig.connectionString ? 'connectionString' : 'manual');

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });