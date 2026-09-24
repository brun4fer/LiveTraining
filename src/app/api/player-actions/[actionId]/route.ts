import { handleApiError, noContent, readJson } from "@/lib/api";
import { deletePlayerAction, updatePlayerAction } from "@/lib/data-store";

export async function PATCH(request: Request, context: { params: Promise<{ actionId: string }> }) {
  try { return Response.json(await updatePlayerAction((await context.params).actionId, await readJson<Record<string, unknown>>(request))); }
  catch (error) { return handleApiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ actionId: string }> }) {
  try { await deletePlayerAction((await context.params).actionId); return noContent(); }
  catch (error) { return handleApiError(error); }
}
