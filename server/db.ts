import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use DATABASE_URL for Supabase connection
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log('Original DATABASE_URL length:', databaseUrl.length);
console.log('DATABASE_URL starts with:', databaseUrl.substring(0, 50));

// URL encode special characters in password if needed
if (databaseUrl.includes('*') || databaseUrl.includes('#')) {
  console.log('Encoding special characters in password...');
  databaseUrl = databaseUrl.replace(/\*/g, '%2A').replace(/#/g, '%23');
}

export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });