import { handleApiError } from "@/lib/api";
import { requireManagementWorkspace } from "@/lib/auth";
import { serializePlannedExercise } from "@/lib/data-store";
import { mediaPrisma } from "@/lib/media-prisma";
import { completeMediaMultipartUpload, headMediaObject } from "@/lib/media-r2";
import { ensureMediaWorkspace } from "@/lib/media-workspace";
import { plannedExerciseForWorkspace } from "@/lib/planned-exercise-video";
import { prisma } from "@/lib/prisma";
import { legacyVideoUploadPartSize, videoUploadPartSize } from "@/lib/video-upload";

export async function POST(request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const account = await requireManagementWorkspace();
    const { workspace } = account;
    const { mediaWorkspace } = await ensureMediaWorkspace(account);
    const { trainingId, plannedExerciseId } = await context.params;
    const body = await request.json();
    const parts = Array.isArray(body.parts) ? body.parts.map((part: { partNumber?: unknown; etag?: unknown }) => ({ partNumber: Number(part.partNumber), etag: typeof part.etag === "string" ? part.etag : "" })) : [];
    const exercise = await plannedExerciseForWorkspace(trainingId, plannedExerciseId, workspace.id);
    if (exercise.videoStorageStatus !== "UPLOADING" || !exercise.videoMediaAssetId || !exercise.videoFileSize) throw new Error("The exercise video upload is no longer active.");
    const fileSize = Number(exercise.videoFileSize);
    const requestedPartSize = Number(body.partSize);
    const allowedPartSizes = [...new Set([videoUploadPartSize(fileSize), legacyVideoUploadPartSize(fileSize)])];
    const partSize = allowedPartSizes.find((candidate) => (!Number.isFinite(requestedPartSize) || requestedPartSize <= 0 || candidate === requestedPartSize) && Math.ceil(fileSize / candidate) === parts.length);
    const expectedParts = partSize ? Math.ceil(fileSize / partSize) : 0;
    const unique = new Set(parts.map((part: { partNumber: number }) => part.partNumber));
    if (parts.length !== expectedParts || unique.size !== expectedParts || parts.some((part: { partNumber: number; etag: string }) => !Number.isInteger(part.partNumber) || part.partNumber < 1 || part.partNumber > expectedParts || !part.etag)) throw new Error("The uploaded video is missing one or more parts.");
    const asset = await mediaPrisma.mediaAsset.findFirst({ where: { id: exercise.videoMediaAssetId, mediaWorkspaceId: mediaWorkspace.id, storageStatus: "UPLOADING" } });
    if (!asset?.uploadId || asset.uploadId !== body.uploadId) throw new Error("The shared multipart upload is no longer active.");
    const etag = await completeMediaMultipartUpload(asset.storageKey, asset.uploadId, parts);
    const head = await headMediaObject(asset.storageKey);
    if (head.contentLength !== fileSize) throw new Error("The completed cloud video size does not match the selected file.");
    const uploadedAt = new Date();
    await mediaPrisma.mediaAsset.update({ where: { id: asset.id }, data: { storageStatus: "READY", uploadId: null, etag: etag || head.etag, uploadedAt } });
    const saved = await prisma.plannedExercise.update({ where: { id: exercise.id }, data: { videoStorageStatus: "READY", videoEtag: etag || head.etag, videoUploadedAt: uploadedAt } });
    return Response.json({ exercise: serializePlannedExercise(saved as unknown as Record<string, unknown>) });
  } catch (error) { return handleApiError(error); }
}
