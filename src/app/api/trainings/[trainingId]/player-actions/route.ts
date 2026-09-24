import { handleApiError, readJson } from "@/lib/api";
import { createPlayerAction } from "@/lib/data-store";

export async function POST(request: Request, context: { params: Promise<{ trainingId: string }> }) {
  try { return Response.json(await createPlayerAction((await context.params).trainingId, await readJson<Record<string, unknown>>(request)), { status: 201 }); }
  catch (error) { return handleApiError(error); }
}
