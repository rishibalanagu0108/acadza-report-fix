import { createDecision, ReviewError } from "../../../../lib/reviews/logic";
import { saveDecision } from "../../../../lib/reviews/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ reportId: string }> };

export async function POST(request: Request, { params }: Params) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "This request did not come from this review desk." }, { status: 403 });
  }

  try {
    const { reportId } = await params;
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Invalid decision." }, { status: 400 });
    }
    const decision = createDecision({ ...body, reportId });
    const saved = await saveDecision(decision);
    return Response.json({ decision: saved }, { status: 201 });
  } catch (error) {
    if (error instanceof ReviewError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Could not save this decision. Check the database and try again." }, { status: 503 });
  }
}
