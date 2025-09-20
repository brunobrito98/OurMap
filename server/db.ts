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

// Parse connection string manually to handle special characters
function parseConnectionString(connectionString: string) {
  try {
    // Try to parse as URL first
    const url = new URL(connectionString);
    return {
      connectionString: connectionString,
      ssl: true
    };
  } catch {
    // If URL parsing fails, try to extract components manually
    const match = connectionString.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (match) {
      const [, username, password, host, port, database] = match;
      return {
        user: username,
        password: password,
        host: host,
        port: parseInt(port),
        database: database,
        ssl: true
      };
    } else {
      // Fallback to original string
      return {
        connectionString: connectionString,
        ssl: true
      };
    }
  }
}

const poolConfig = parseConnectionString(databaseUrl);
console.log('Pool config type:', poolConfig.connectionString ? 'connectionString' : 'manual');

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });