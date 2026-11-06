import { handleApiError } from "@/lib/api";
import { requireManagementWorkspace, requireWorkspace } from "@/lib/auth";
import { removeMediaReference } from "@/lib/media-library";
import { mediaPrisma } from "@/lib/media-prisma";
import { abortMediaMultipartUpload } from "@/lib/media-r2";
import { ensureMediaWorkspace } from "@/lib/media-workspace";
import { plannedExerciseForWorkspace, plannedExerciseVideoPlaybackUrl, plannedExerciseVideoReferenceId } from "@/lib/planned-exercise-video";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const account = await requireWorkspace();
    const { mediaWorkspace } = await ensureMediaWorkspace(account);
    const { trainingId, plannedExerciseId } = await context.params;
    return Response.json(await plannedExerciseVideoPlaybackUrl({ trainingId, plannedExerciseId, workspaceId: account.workspace.id, mediaWorkspaceId: mediaWorkspace.id }));
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const account = await requireManagementWorkspace();
    const { appId, mediaWorkspace } = await ensureMediaWorkspace(account);
    const { trainingId, plannedExerciseId } = await context.params;
    const exercise = await plannedExerciseForWorkspace(trainingId, plannedExerciseId, account.workspace.id);
    if (exercise.videoMediaAssetId) {
      const pending = await mediaPrisma.mediaAsset.findFirst({ where: { id: exercise.videoMediaAssetId, mediaWorkspaceId: mediaWorkspace.id, storageStatus: "UPLOADING" } });
      if (pending?.uploadId) {
        await abortMediaMultipartUpload(pending.storageKey, pending.uploadId).catch(() => undefined);
        await mediaPrisma.mediaAsset.update({ where: { id: pending.id }, data: { storageStatus: "FAILED", uploadId: null } }).catch(() => undefined);
      }
      await removeMediaReference(appId, plannedExerciseVideoReferenceId(exercise.id));
    }
    await prisma.plannedExercise.update({ where: { id: exercise.id }, data: {
      videoFileName: null, videoFileSize: null, videoDurationSeconds: null, videoMimeType: null, videoLastModified: null,
      videoStorageStatus: null, videoMediaAssetId: null, videoEtag: null, videoUploadedAt: null,
    } });
    return Response.json({ removed: true });
  } catch (error) { return handleApiError(error); }
}
