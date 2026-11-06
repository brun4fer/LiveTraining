import { handleApiError } from "@/lib/api";
import { requireManagementWorkspace } from "@/lib/auth";
import { mediaPrisma } from "@/lib/media-prisma";
import { presignMediaMultipartParts } from "@/lib/media-r2";
import { ensureMediaWorkspace } from "@/lib/media-workspace";
import { plannedExerciseForWorkspace } from "@/lib/planned-exercise-video";

export async function POST(request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const account = await requireManagementWorkspace();
    const { workspace } = account;
    const { mediaWorkspace } = await ensureMediaWorkspace(account);
    const { trainingId, plannedExerciseId } = await context.params;
    const body = await request.json();
    const partNumbers: number[] = Array.isArray(body.partNumbers) ? [...new Set<number>(body.partNumbers.map(Number))] : [];
    if (!body.uploadId || !partNumbers.length || partNumbers.length > 500 || partNumbers.some((part) => !Number.isInteger(part) || part < 1 || part > 10_000)) throw new Error("Invalid multipart upload request.");
    const exercise = await plannedExerciseForWorkspace(trainingId, plannedExerciseId, workspace.id);
    if (exercise.videoStorageStatus !== "UPLOADING" || !exercise.videoMediaAssetId) throw new Error("The exercise video upload is no longer active.");
    const asset = await mediaPrisma.mediaAsset.findFirst({ where: { id: exercise.videoMediaAssetId, mediaWorkspaceId: mediaWorkspace.id, storageStatus: "UPLOADING" } });
    if (!asset?.uploadId || asset.uploadId !== body.uploadId) throw new Error("The shared multipart upload is no longer active.");
    return Response.json({ parts: presignMediaMultipartParts(asset.storageKey, asset.uploadId, partNumbers) });
  } catch (error) { return handleApiError(error); }
}
