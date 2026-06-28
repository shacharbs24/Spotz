import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Single shared client. Neon pooler handles connection multiplexing,
// so we keep the postgres-js pool small for serverless friendliness.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });

export * as schema from "./schema";
export { schema as tables };

// Re-export common query operators so consumers don't need a direct
// drizzle-orm dependency.
export { eq, and, or, asc, desc, gt, gte, lt, lte, sql } from "drizzle-orm";
