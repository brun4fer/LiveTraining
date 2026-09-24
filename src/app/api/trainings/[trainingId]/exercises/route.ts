import { handleApiError, readJson } from "@/lib/api";
import { endExercise, startExercise } from "@/lib/data-store";

export async function POST(request: Request, context: { params: Promise<{ trainingId: string }> }) {
  try {
    const { trainingId } = await context.params;
    const body = await readJson<Record<string, unknown>>(request);
    return Response.json(body.action === "end" ? await endExercise(trainingId, body) : await startExercise(trainingId, body), { status: body.action === "end" ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
