import { handleApiError, noContent, readJson } from "@/lib/api";
import { requireWorkspace } from "@/lib/auth";
import { deletePlannedExercise, serializePlannedExercise, updatePlannedExercise } from "@/lib/data-store";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const { workspace } = await requireWorkspace();
    const { trainingId, plannedExerciseId } = await context.params;
    const exercise = await prisma.plannedExercise.findFirstOrThrow({ where: { id: plannedExerciseId, trainingId, training: { workspaceId: workspace.id } } });
    return Response.json(serializePlannedExercise(exercise as unknown as Record<string, unknown>));
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const { trainingId, plannedExerciseId } = await context.params;
    return Response.json(await updatePlannedExercise(trainingId, plannedExerciseId, await readJson<Record<string, unknown>>(request)));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const { trainingId, plannedExerciseId } = await context.params;
    await deletePlannedExercise(trainingId, plannedExerciseId);
    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}
