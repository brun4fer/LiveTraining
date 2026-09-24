import { handleApiError, readJson } from "@/lib/api";
import { markLivePlayerAction } from "@/lib/live-store";

export async function POST(request: Request, context: { params: Promise<{ trainingId: string }> }) {
  try { return Response.json(await markLivePlayerAction((await context.params).trainingId, await readJson<Record<string, unknown>>(request)), { status: 201 }); }
  catch (error) { return handleApiError(error); }
}
