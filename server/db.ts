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

// Configure connection based on environment
function parseConnectionString(connectionString: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // For local development in Replit, don't use SSL
  if (isDevelopment && connectionString.includes('localhost')) {
    return {
      connectionString: connectionString.replace('?sslmode=require', ''),
      ssl: false,
    };
  }
  
  // For production or external databases, use SSL
  return {
    connectionString: connectionString,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  };
}

const poolConfig = parseConnectionString(databaseUrl);
console.log(
  "Pool config type:",
  poolConfig.connectionString ? "connectionString" : "manual",
);

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });