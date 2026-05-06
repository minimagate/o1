import { refreshModelSnapshot } from "@/lib/model-snapshot";

export const runtime = "nodejs";

async function handleCronRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedHeader = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedHeader) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await refreshModelSnapshot({ persist: true });

  return Response.json({
    ok: true,
    generatedAt: snapshot.generatedAt,
    counts: snapshot.counts,
  });
}

export async function GET(request: Request) {
  return handleCronRequest(request);
}

export async function POST(request: Request) {
  return handleCronRequest(request);
}
