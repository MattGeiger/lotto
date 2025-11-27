import { Pool } from "@neondatabase/serverless";

let pool: Pool | null = null;

export const getPool = () => {
  if (pool) {
    return pool;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize the database pool.");
  }
  pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  return pool;
};
