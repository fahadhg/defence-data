/**
 * client.ts - Neon/Drizzle client. Deliberately NOT marked "server-only" so it can be imported
 * from both Next.js server components (via lib/data.ts, which is server-only) and standalone
 * ingest scripts run via tsx outside the Next.js bundler.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
