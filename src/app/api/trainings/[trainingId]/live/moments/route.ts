import { handleApiError, readJson } from "@/lib/api";
import { markLiveMoment } from "@/lib/live-store";

export async function POST(request: Request, context: { params: Promise<{ trainingId: string }> }) {
  try {
    const { trainingId } = await context.params;
    return Response.json(await markLiveMoment(trainingId, await readJson<Record<string, unknown>>(request)), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
