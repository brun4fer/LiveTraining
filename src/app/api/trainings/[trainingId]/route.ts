import { handleApiError, noContent, readJson } from "@/lib/api";
import { deleteTraining, getTraining, updateTraining } from "@/lib/data-store";

export async function GET(_request: Request, context: { params: Promise<{ trainingId: string }> }) {
  try { return Response.json(await getTraining((await context.params).trainingId)); }
  catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ trainingId: string }> }) {
  try { return Response.json(await updateTraining((await context.params).trainingId, await readJson<Record<string, unknown>>(request))); }
  catch (error) { return handleApiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ trainingId: string }> }) {
  try { await deleteTraining((await context.params).trainingId); return noContent(); }
  catch (error) { return handleApiError(error); }
}

