import { checkDatabase } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connected = await checkDatabase();
    return Response.json({ service: "postgres", connected }, { status: connected ? 200 : 503 });
  } catch {
    return Response.json({ service: "postgres", connected: false }, { status: 503 });
  }
}
