import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// Use DATABASE_URL for Supabase connection
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// For Supabase, use connectionString directly as it handles query params properly
const poolConfig = databaseUrl.includes('supabase.com') 
  ? {
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    }
  : {
      connectionString: databaseUrl
    };

const pool = new Pool(poolConfig);

console.log("Connected to Supabase database");

export { pool };
export const db = drizzle(pool, { schema });