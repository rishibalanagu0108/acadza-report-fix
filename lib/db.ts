import { neon } from "@neondatabase/serverless";

export async function checkDatabase(): Promise<boolean> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return false;

  const sql = neon(connectionString);
  const rows = await sql`SELECT 1 AS connected`;
  return rows[0]?.connected === 1;
}
